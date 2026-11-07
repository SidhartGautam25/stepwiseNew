import type { Request, Response } from 'express';
import { AUTH_COOKIES } from '@app/contracts';

export function isSecureCookieEnabled(): boolean {
  return process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
}

export function getCookieNames() {
  const secure = isSecureCookieEnabled();
  return {
    accessToken: secure ? AUTH_COOKIES.ACCESS_TOKEN : AUTH_COOKIES.DEV_ACCESS_TOKEN,
    refreshToken: secure ? AUTH_COOKIES.REFRESH_TOKEN : AUTH_COOKIES.DEV_REFRESH_TOKEN,
  };
}

export interface SetAuthCookiesParams {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number; // In seconds
}

export function setAuthCookies(res: Response, params: SetAuthCookiesParams) {
  const { accessToken, refreshToken, expiresIn } = params;
  const secure = isSecureCookieEnabled();
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const names = getCookieNames();

  // Access token cookie (lifetime 15-30m, path /)
  const atMaxAge = (expiresIn || 900) * 1000;
  res.cookie(names.accessToken, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: atMaxAge,
    domain,
  });

  // Refresh token cookie (path /v1/auth, 30 days)
  const rtMaxAge = 30 * 24 * 60 * 60 * 1000;
  res.cookie(names.refreshToken, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: rtMaxAge,
    domain,
  });
}

export function clearAuthCookies(res: Response) {
  const secure = isSecureCookieEnabled();
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const names = getCookieNames();

  res.cookie(names.accessToken, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    domain,
  });

  res.cookie(names.refreshToken, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: 0,
    expires: new Date(0),
    domain,
  });
}

export function extractRefreshToken(req: Request): string | null {
  const names = getCookieNames();

  // 1. Check req.cookies
  if (req.cookies) {
    if (req.cookies[names.refreshToken]) {
      return req.cookies[names.refreshToken];
    }
    if (req.cookies[AUTH_COOKIES.DEV_REFRESH_TOKEN]) {
      return req.cookies[AUTH_COOKIES.DEV_REFRESH_TOKEN];
    }
    if (req.cookies[AUTH_COOKIES.REFRESH_TOKEN]) {
      return req.cookies[AUTH_COOKIES.REFRESH_TOKEN];
    }
  }

  // 2. Check raw cookie header
  const rawCookie = req.headers['cookie'];
  if (rawCookie) {
    const cookies = parseRawCookies(rawCookie);
    if (cookies[names.refreshToken]) {
      return cookies[names.refreshToken];
    }
    if (cookies[AUTH_COOKIES.DEV_REFRESH_TOKEN]) {
      return cookies[AUTH_COOKIES.DEV_REFRESH_TOKEN];
    }
    if (cookies[AUTH_COOKIES.REFRESH_TOKEN]) {
      return cookies[AUTH_COOKIES.REFRESH_TOKEN];
    }
  }

  // 3. Check JSON body fallback for non-browser API clients
  if (req.body && typeof req.body['refreshToken'] === 'string') {
    return req.body['refreshToken'];
  }

  return null;
}

function parseRawCookies(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  cookieHeader.split(';').forEach((part) => {
    const [key, ...vals] = part.split('=');
    if (key && vals.length > 0) {
      map[key.trim()] = decodeURIComponent(vals.join('=').trim());
    }
  });
  return map;
}
