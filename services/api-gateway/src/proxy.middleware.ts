import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response, NextFunction } from 'express';
import { SupabaseJwtVerifier, TokenRevocationService } from '@app/auth';
import { CORRELATION_ID_HEADER } from '@app/common';
import { AUTH_COOKIES } from '@app/contracts';
import { getGatewayRoutes, isBlockedRoute, type RouteConfig } from './routes.config.js';
import crypto from 'node:crypto';

export function setupGatewayProxy(
  app: any,
  jwtVerifier: SupabaseJwtVerifier,
  revocationService?: TokenRevocationService,
) {
  const routes = getGatewayRoutes();

  // Create individual proxy middleware instances mapped by target
  const proxyCache = new Map<string, any>();
  const getProxy = (target: string, isSse?: boolean) => {
    const key = `${target}::${Boolean(isSse)}`;
    if (!proxyCache.has(key)) {
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        // Disable internal buffering to ensure SSE and body streams flow freely
        buffer: undefined,
        on: {
          proxyReq: (proxyReq, req: any) => {
            // Forward correlation ID / x-request-id
            const reqId = req.headers['x-request-id'] || req.headers[CORRELATION_ID_HEADER];
            if (reqId) {
              proxyReq.setHeader('x-request-id', reqId);
              proxyReq.setHeader(CORRELATION_ID_HEADER, reqId);
            }

            // Forward client IP
            const clientIp =
              req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
            if (clientIp) {
              proxyReq.setHeader('x-forwarded-for', clientIp);
            }

            // Cookie to Authorization header translation
            if (req.headers['authorization']) {
              proxyReq.setHeader('authorization', req.headers['authorization']);
            }

            // Ensure inbound forged headers are stripped at the edge proxy
            for (const headerName of Object.keys(req.headers)) {
              if (headerName.toLowerCase().startsWith('x-user-')) {
                proxyReq.removeHeader(headerName);
              }
            }
          },
          proxyRes: (proxyRes, req, res: any) => {
            if (isSse) {
              res.setHeader('Cache-Control', 'no-cache, no-transform');
              res.setHeader('Content-Type', 'text/event-stream');
              res.setHeader('Connection', 'keep-alive');
              res.setHeader('X-Accel-Buffering', 'no');
              if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
              }
            }
          },
        },
      });
      proxyCache.set(key, proxy);
    }
    return proxyCache.get(key);
  };

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl || req.url;
    const pathname = url.split('?')[0];

    // 1. Allow health endpoints to be handled locally by HealthController
    if (pathname === '/health' || pathname === '/health/ready' || pathname === '/health/live') {
      return next();
    }

    // 2. Strict block: /internal/* and /.well-known/* are never routable
    if (isBlockedRoute(pathname)) {
      return res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${pathname} is not routable`,
      });
    }

    // 3. Find matching route in gateway route table
    const method = req.method.toUpperCase();
    const matchedRoute = routes.find((route) => {
      if (route.methods && !route.methods.includes(method)) {
        return false;
      }
      if (route.matcher) {
        return route.matcher(pathname, method);
      }
      return pathname === route.prefix || pathname.startsWith(`${route.prefix}/`);
    });

    // 4. Default: Routes not in the table are 404
    if (!matchedRoute) {
      return res.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${pathname} not found in gateway routing table`,
      });
    }

    // 5. Hygiene: Strip any incoming x-user-* headers from client
    for (const key of Object.keys(req.headers)) {
      if (key.toLowerCase().startsWith('x-user-')) {
        delete req.headers[key];
      }
    }

    // 6. Request ID hygiene
    if (!req.headers['x-request-id'] && !req.headers[CORRELATION_ID_HEADER]) {
      const generatedId = crypto.randomUUID();
      req.headers['x-request-id'] = generatedId;
      req.headers[CORRELATION_ID_HEADER] = generatedId;
    }

    // 7. Token extraction from Authorization header or cookie
    const token = extractToken(req);

    // 8. Auth mode evaluation
    if (matchedRoute.authMode === 'jwt') {
      if (!token) {
        return res.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required: missing Bearer token or session cookie',
        });
      }

      try {
        const user = await jwtVerifier.verifyToken(token);

        // Redis revocation check
        if (revocationService) {
          const isRevoked = await revocationService.isRevoked({
            userId: user.id,
            sessionId: user.sessionId,
          });
          if (isRevoked) {
            return res.status(401).json({
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Authentication session has been revoked',
            });
          }
        }

        // Attach verified user and translate cookie to Authorization header for downstream
        (req as any).user = user;
        req.headers['authorization'] = `Bearer ${token}`;
      } catch (err: any) {
        return res.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: err.message || 'Invalid or expired authentication token',
        });
      }
    } else if (matchedRoute.authMode === 'public') {
      if (token) {
        try {
          const user = await jwtVerifier.verifyToken(token);
          (req as any).user = user;
          req.headers['authorization'] = `Bearer ${token}`;
        } catch {
          // Public routes gracefully allow unauthenticated or invalid token requests
        }
      }
    }
    // 'passthrough' routes proceed directly without touching Authorization or verifying JWT

    // 9. Delegate to http-proxy-middleware
    const proxy = getProxy(matchedRoute.target, matchedRoute.isSse);
    return proxy(req, res, next);
  });
}

function extractToken(req: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Cookie: __Secure-hr_at or hr_at
  const rawCookie = req.headers['cookie'];
  if (rawCookie && typeof rawCookie === 'string') {
    const parsed = parseCookies(rawCookie);
    if (parsed[AUTH_COOKIES.ACCESS_TOKEN]) {
      return parsed[AUTH_COOKIES.ACCESS_TOKEN];
    }
    if (parsed[AUTH_COOKIES.DEV_ACCESS_TOKEN]) {
      return parsed[AUTH_COOKIES.DEV_ACCESS_TOKEN];
    }
  }

  if (req.cookies) {
    if (req.cookies[AUTH_COOKIES.ACCESS_TOKEN]) {
      return req.cookies[AUTH_COOKIES.ACCESS_TOKEN];
    }
    if (req.cookies[AUTH_COOKIES.DEV_ACCESS_TOKEN]) {
      return req.cookies[AUTH_COOKIES.DEV_ACCESS_TOKEN];
    }
  }

  return null;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      map[key] = decodeURIComponent(val);
    }
  });
  return map;
}
