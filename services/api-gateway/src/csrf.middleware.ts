import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIES, CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@app/contracts';

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  private allowedOrigins: string[];

  constructor() {
    const rawOrigins = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000';
    this.allowedOrigins = rawOrigins
      .split(',')
      .map((o) => o.trim().toLowerCase().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    const hasCookieAuth = this.detectCookieAuth(req);
    // Bearer-only requests skip CSRF check
    if (!hasCookieAuth) {
      return next();
    }

    // 1. Origin (or Referer) check against allowlist
    const origin = (req.headers['origin'] as string | undefined)?.toLowerCase().replace(/\/+$/, '');
    const referer = (req.headers['referer'] as string | undefined)?.toLowerCase();

    let matchesOrigin = false;
    if (origin) {
      matchesOrigin = this.allowedOrigins.some((allowed) => origin === allowed);
    } else if (referer) {
      matchesOrigin = this.allowedOrigins.some((allowed) => referer.startsWith(allowed));
    }

    if (!matchesOrigin) {
      throw new ForbiddenException(
        'Forbidden: CSRF origin validation failed. Disallowed or missing Origin/Referer header.',
      );
    }

    // 2. Custom header X-Requested-With: handrail check
    const customHeader = req.headers[CSRF_HEADER_NAME.toLowerCase()] || req.headers[CSRF_HEADER_NAME];
    if (customHeader !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException(
        `Forbidden: CSRF validation failed. Missing or invalid ${CSRF_HEADER_NAME} header.`,
      );
    }

    next();
  }

  private detectCookieAuth(req: Request): boolean {
    const rawCookie = req.headers['cookie'];
    if (rawCookie) {
      const cookieKeys = [
        AUTH_COOKIES.ACCESS_TOKEN,
        AUTH_COOKIES.DEV_ACCESS_TOKEN,
        AUTH_COOKIES.REFRESH_TOKEN,
        AUTH_COOKIES.DEV_REFRESH_TOKEN,
      ];
      return cookieKeys.some((name) => rawCookie.includes(`${name}=`));
    }

    if (req.cookies) {
      return Boolean(
        req.cookies[AUTH_COOKIES.ACCESS_TOKEN] ||
          req.cookies[AUTH_COOKIES.DEV_ACCESS_TOKEN] ||
          req.cookies[AUTH_COOKIES.REFRESH_TOKEN] ||
          req.cookies[AUTH_COOKIES.DEV_REFRESH_TOKEN],
      );
    }

    return false;
  }
}
