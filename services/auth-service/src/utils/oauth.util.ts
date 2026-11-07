import type { Request, Response } from 'express';
import { isSecureCookieEnabled } from './cookie.util.js';

export const PKCE_COOKIE_NAME = 'hr_pkce';

export interface PkceCookieData {
  verifier: string;
  flowId?: string;
  next: string;
  storageKey?: string;
}

/**
 * Validates 'next' parameter against open-redirect attacks.
 * Allows safe relative paths or explicitly allowlisted web application URLs.
 */
export function validateNextRedirect(nextParam?: string): string {
  if (!nextParam || typeof nextParam !== 'string') {
    return '/';
  }

  const trimmed = nextParam.trim();

  // 1. Safe relative paths (must start with single '/', not '//' or '/\')
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  // 2. Allowlisted absolute URLs
  const allowedHosts = (process.env.ALLOWED_REDIRECT_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);

  try {
    const url = new URL(trimmed);
    const origin = url.origin.toLowerCase();
    if (allowedHosts.includes(origin)) {
      return trimmed;
    }
  } catch {
    // Malformed URL falls through to safe default
  }

  return '/';
}

export function setPkceCookie(res: Response, data: PkceCookieData) {
  const secure = isSecureCookieEnabled();
  const domain = process.env.COOKIE_DOMAIN || undefined;

  const serialized = Buffer.from(JSON.stringify(data)).toString('base64url');

  res.cookie(PKCE_COOKIE_NAME, serialized, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/v1/auth/oauth',
    maxAge: 10 * 60 * 1000, // 10 minutes
    domain,
  });
}

export function extractPkceCookie(req: Request): PkceCookieData | null {
  const rawCookie =
    req.cookies?.[PKCE_COOKIE_NAME] ||
    parseRawCookieHeader(req.headers['cookie'] || '')[PKCE_COOKIE_NAME];

  if (!rawCookie || typeof rawCookie !== 'string') {
    return null;
  }

  try {
    const jsonStr = Buffer.from(rawCookie, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as PkceCookieData;
  } catch {
    return null;
  }
}

export function clearPkceCookie(res: Response) {
  const secure = isSecureCookieEnabled();
  const domain = process.env.COOKIE_DOMAIN || undefined;

  res.cookie(PKCE_COOKIE_NAME, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/v1/auth/oauth',
    maxAge: 0,
    expires: new Date(0),
    domain,
  });
}

function parseRawCookieHeader(cookieHeader: string): Record<string, string> {
  const map: Record<string, string> = {};
  cookieHeader.split(';').forEach((part) => {
    const [key, ...vals] = part.split('=');
    if (key && vals.length > 0) {
      map[key.trim()] = decodeURIComponent(vals.join('=').trim());
    }
  });
  return map;
}
