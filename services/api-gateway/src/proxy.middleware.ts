import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response, NextFunction } from 'express';
import { JwtVerifierService } from '@app/auth';
import { CORRELATION_ID_HEADER } from '@app/common';

export interface RouteProxyConfig {
  path: string;
  target: string;
  requireAuth?: boolean;
  isSse?: boolean;
}

export function setupStaticProxies(app: any, verifier: JwtVerifierService) {
  const routes: RouteProxyConfig[] = [
    {
      path: '/v1/workshops',
      target: process.env.CATALOG_SERVICE_URL || 'http://localhost:4001',
    },
    {
      path: '/internal/content',
      target: process.env.CATALOG_SERVICE_URL || 'http://localhost:4001',
    },
    {
      path: '/v1/starters',
      target: process.env.STARTER_SERVICE_URL || 'http://localhost:4002',
      requireAuth: true,
    },
    {
      path: '/v1/verify',
      target: process.env.VERIFICATION_SERVICE_URL || 'http://localhost:4003',
    },
    {
      path: '/v1/progress',
      target: process.env.PROGRESS_SERVICE_URL || 'http://localhost:4004',
      requireAuth: true,
    },
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

    app.use(route.path, authMiddleware, proxy);
  });
}
