import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response, NextFunction } from 'express';
import { JwtVerifierService } from '@app/auth';
import { CORRELATION_ID_HEADER } from '@app/common';

export interface RouteProxyConfig {
  path: string;
  target: string;
  requireAuth?: boolean;
  isSse?: boolean;
  matcher?: (pathname: string) => boolean;
}

export function setupStaticProxies(app: any, verifier: JwtVerifierService) {
  const routes: RouteProxyConfig[] = [
    // 1. Enrollment & Progress routes (directed to progress-service)
    {
      path: '/v1/workshops/enroll-or-progress',
      target: process.env.PROGRESS_SERVICE_URL || 'http://localhost:4004',
      requireAuth: true,
      matcher: (pathname: string) =>
        /^\/(v1\/)?workshops\/[^/]+\/(enroll|progress)$/.test(pathname) ||
        pathname.startsWith('/v1/progress'),
    },
    // 2. Starter download route (publicly accessible via signed HMAC token)
    {
      path: '/v1/starters/download',
      target: process.env.STARTER_SERVICE_URL || 'http://localhost:4002',
      requireAuth: false,
      matcher: (pathname: string) =>
        /^\/(v1\/)?starters\/[^/]+\/[^/]+\/download$/.test(pathname),
    },
    // 3. Starter metadata & info route (requires auth)
    {
      path: '/v1/starters',
      target: process.env.STARTER_SERVICE_URL || 'http://localhost:4002',
      requireAuth: true,
      matcher: (pathname: string) =>
        pathname === '/v1/starters' ||
        pathname.startsWith('/v1/starters/') ||
        pathname.startsWith('/starters/'),
    },
    // 4. Catalog & Workshops exploration routes
    {
      path: '/v1/workshops',
      target: process.env.CATALOG_SERVICE_URL || 'http://localhost:4001',
      requireAuth: false,
      matcher: (pathname: string) =>
        pathname === '/v1/workshops' ||
        pathname.startsWith('/v1/workshops/') ||
        pathname === '/workshops' ||
        pathname.startsWith('/workshops/'),
    },
    // 5. Internal content sync route
    {
      path: '/internal/content',
      target: process.env.CATALOG_SERVICE_URL || 'http://localhost:4001',
      requireAuth: false,
    },
    // 6. Verification service routes
    {
      path: '/v1/verify',
      target: process.env.VERIFICATION_SERVICE_URL || 'http://localhost:4003',
      requireAuth: false,
    },
    // 7. Realtime SSE event stream
    {
      path: '/v1/realtime',
      target: process.env.REALTIME_SERVICE_URL || 'http://localhost:4005',
      requireAuth: true,
      isSse: true,
    },
  ];

  routes.forEach((route) => {
    const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        try {
          const user = await verifier.verifyToken(token);
          req.headers['x-user-id'] = user.id;
          req.headers['x-user-email'] = user.email;
          req.headers['x-user-role'] = user.role;
        } catch (err: any) {
          if (route.requireAuth) {
            return res.status(401).json({
              statusCode: 401,
              message: 'Unauthorized: Invalid token',
              error: err.message,
            });
          }
        }
      } else if (route.requireAuth) {
        return res.status(401).json({
          statusCode: 401,
          message: 'Unauthorized: Missing bearer token',
        });
      }
      next();
    };

    const proxy = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req: any) => {
          const corrId = req.headers[CORRELATION_ID_HEADER];
          if (corrId) {
            proxyReq.setHeader(CORRELATION_ID_HEADER, corrId);
          }
          if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
            proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
            proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
          }
        },
        proxyRes: (proxyRes, req, res: any) => {
          if (route.isSse) {
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

    app.use((req: Request, res: Response, next: NextFunction) => {
      const url = req.originalUrl || req.url;
      const pathname = url.split('?')[0];

      let isMatch = false;
      if (route.matcher) {
        isMatch = route.matcher(pathname);
      } else {
        isMatch = pathname === route.path || pathname.startsWith(route.path + '/');
      }

      if (isMatch) {
        return authMiddleware(req, res, () => {
          proxy(req, res, next);
        });
      }
      next();
    });
  });
}
