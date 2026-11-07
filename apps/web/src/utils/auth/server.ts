import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { env } from '@/config/env';
import type { Session, SessionUser } from './client';
import * as jose from 'jose';

/**
 * Reads the access token from the HttpOnly session cookie on the server.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  // Try configured cookie name first
  const configuredName = env.AUTH_ACCESS_COOKIE_NAME;
  const primaryCookie = cookieStore.get(configuredName)?.value;
  if (primaryCookie) return primaryCookie;

  // Fallback check between dev and secure prefixes
  const devCookie = cookieStore.get('hr_at')?.value;
  if (devCookie) return devCookie;

  const secureCookie = cookieStore.get('__Secure-hr_at')?.value;
  if (secureCookie) return secureCookie;

  return null;
}

/**
 * Server-side fetch wrapper for Server Components, Route Handlers, and Server Actions:
 * - Uses API_INTERNAL_URL (e.g. internal network/Docker gateway address)
 * - Sets Authorization: Bearer <accessToken>
 * - cache: 'no-store'
 * - Invariant: Never forwards cookies, preventing CSRF issues with the gateway
 */
export async function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = env.API_INTERNAL_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  const token = await getAccessToken();

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(fullUrl, {
    ...init,
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Server fetch failed for [${path}] with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return {} as T;
}

/**
 * Returns the current authenticated session on the server.
 * Wrapped in React cache() so multiple Server Components in a single render share the result.
 * Never throws on 401; returns null instead.
 * Never attempts token refresh (Server Components cannot set cookies).
 */
export const getServerSession = cache(async (): Promise<Session | null> => {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const user = await serverFetch<SessionUser>('/v1/auth/me');
    if (!user || !user.id) {
      return null;
    }

    // Decode JWT expiration hint without verification
    let expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;
    try {
      const decoded = jose.decodeJwt(token);
      if (decoded.exp) {
        expiresAt = decoded.exp;
      }
    } catch {
      // Fallback to default
    }

    return {
      user: {
        ...user,
        displayName: user.displayName || user.email.split('@')[0],
      },
      expiresAt,
    };
  } catch {
    return null;
  }
});
