import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateRedirectTarget, isProtectedRoute, isAuthPage } from './routes';
import { emitAuthEvent, subscribeAuthEvent } from './events';
import { apiFetch, executeSingleFlightRefresh, ApiError } from './client';
import { handleAuthMiddleware } from './middleware';
import * as jose from 'jose';

describe('A6.1 Redirect Target Validator', () => {
  it('allows safe relative paths', () => {
    expect(validateRedirectTarget('/dashboard')).toBe('/dashboard');
    expect(validateRedirectTarget('/settings/profile')).toBe('/settings/profile');
    expect(validateRedirectTarget('/workshops?filter=ts')).toBe('/workshops?filter=ts');
  });

  it('rejects protocol-relative open-redirect attempts', () => {
    expect(validateRedirectTarget('//evil.example.com')).toBe('/dashboard');
    expect(validateRedirectTarget('//evil.example.com/phish')).toBe('/dashboard');
    expect(validateRedirectTarget('/\\evil.example.com')).toBe('/dashboard');
  });

  it('rejects external URLs with schemes', () => {
    expect(validateRedirectTarget('https://evil.example.com/login')).toBe('/dashboard');
    expect(validateRedirectTarget('http://attacker.com')).toBe('/dashboard');
    expect(validateRedirectTarget('javascript:alert(1)')).toBe('/dashboard');
  });

  it('handles null, undefined, and empty inputs with default fallback', () => {
    expect(validateRedirectTarget(null)).toBe('/dashboard');
    expect(validateRedirectTarget(undefined)).toBe('/dashboard');
    expect(validateRedirectTarget('')).toBe('/dashboard');
    expect(validateRedirectTarget('   ')).toBe('/dashboard');
  });

  it('supports custom fallback destination', () => {
    expect(validateRedirectTarget('//evil.com', '/workshops')).toBe('/workshops');
  });
});

describe('A6.1 Route Classifiers', () => {
  it('correctly identifies protected routes', () => {
    expect(isProtectedRoute('/dashboard')).toBe(true);
    expect(isProtectedRoute('/dashboard/billing')).toBe(true);
    expect(isProtectedRoute('/settings')).toBe(true);
    expect(isProtectedRoute('/settings/security')).toBe(true);
    expect(isProtectedRoute('/')).toBe(false);
    expect(isProtectedRoute('/workshops')).toBe(false);
    expect(isProtectedRoute('/login')).toBe(false);
  });

  it('correctly identifies auth pages', () => {
    expect(isAuthPage('/login')).toBe(true);
    expect(isAuthPage('/signup')).toBe(true);
    expect(isAuthPage('/forgot-password')).toBe(true);
    expect(isAuthPage('/dashboard')).toBe(false);
    expect(isAuthPage('/')).toBe(false);
  });
});

describe('A6.1 Auth Event Bus', () => {
  it('notifies subscribers of emitted auth events and supports unsubscription', () => {
    const receivedEvents: string[] = [];
    const unsubscribe = subscribeAuthEvent((event) => {
      receivedEvents.push(event);
    });

    emitAuthEvent('SIGNED_IN');
    emitAuthEvent('TOKEN_REFRESHED');
    expect(receivedEvents).toEqual(['SIGNED_IN', 'TOKEN_REFRESHED']);

    unsubscribe();
    emitAuthEvent('SIGNED_OUT');
    // After unsubscribe, no new events should be pushed to receivedEvents
    expect(receivedEvents).toEqual(['SIGNED_IN', 'TOKEN_REFRESHED']);
  });
});

describe('A6.1 Client apiFetch & Single-Flight Refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes credentials: include and X-Requested-With header on all requests', async () => {
    let capturedHeaders: Headers | undefined;
    let capturedCredentials: any;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      capturedHeaders = init.headers;
      capturedCredentials = init.credentials;
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await apiFetch<{ status: string }>('/v1/test');
    expect(res.status).toBe('ok');
    expect(capturedCredentials).toBe('include');
    expect(capturedHeaders?.get('X-Requested-With')).toBe('handrail');
  });

  it('collapses multiple concurrent 401s into exactly ONE refresh call and retries all original requests once', async () => {
    let refreshCalls = 0;
    let originalCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/v1/auth/refresh')) {
        refreshCalls++;
        return new Response(JSON.stringify({ status: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      originalCalls++;
      // First batch of calls fail with 401; subsequent retries succeed
      if (refreshCalls === 0) {
        return new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Fire 5 concurrent requests
    const promises = [
      apiFetch('/v1/profile'),
      apiFetch('/v1/workshops/react/progress'),
      apiFetch('/v1/preferences'),
      apiFetch('/v1/activity'),
      apiFetch('/v1/progress'),
    ];

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    // Crucial: exactly ONE refresh call made across all 5 concurrent 401s
    expect(refreshCalls).toBe(1);
    // 5 initial calls + 5 retries = 10 calls total
    expect(originalCalls).toBe(10);
  });

  it('does not attempt refresh for bypass routes (login, signup, refresh, confirm)', async () => {
    let refreshCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/auth/refresh')) {
        refreshCalls++;
      }
      return new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: 'Wrong password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(apiFetch('/v1/auth/login')).rejects.toThrow(ApiError);
    expect(refreshCalls).toBe(0);
  });

  it('emits SESSION_EXPIRED when refresh fails and does not loop', async () => {
    let expiredEmitted = false;
    const unsub = subscribeAuthEvent((event) => {
      if (event === 'SESSION_EXPIRED') expiredEmitted = true;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/v1/auth/refresh')) {
        return new Response(JSON.stringify({ code: 'INVALID_TOKEN' }), { status: 401 });
      }
      return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
    });

    await expect(apiFetch('/v1/profile')).rejects.toThrow(ApiError);
    expect(expiredEmitted).toBe(true);

    unsub();
  });
});

describe('A6.1 Next.js Edge Middleware', () => {
  function createMockRequest(pathname: string, search: string = '', cookieToken?: string) {
    const url = `http://localhost:3000${pathname}${search}`;
    const nextUrl = new URL(url);

    return {
      url,
      nextUrl,
      headers: new Headers(),
      cookies: {
        get: (name: string) => {
          if (cookieToken) return { name, value: cookieToken };
          return undefined;
        },
      },
    };
  }

  it('redirects to /auth/refresh with next param when accessing protected route without cookie', () => {
    const req = createMockRequest('/dashboard');
    const res = handleAuthMiddleware(req);

    expect(res.status).toBe(307); // NextResponse.redirect
    const location = res.headers.get('location') || '';
    expect(location).toContain('/auth/refresh?next=%2Fdashboard');
  });

  it('redirects to /auth/refresh when access token is expired', () => {
    // Generate expired JWT
    const expiredPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }),
    ).toString('base64url');
    const token = `header.${expiredPayload}.sig`;

    const req = createMockRequest('/settings', '', token);
    const res = handleAuthMiddleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/auth/refresh?next=%2Fsettings');
  });

  it('allows protected route when access token is fresh', () => {
    const freshPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    const token = `header.${freshPayload}.sig`;

    const req = createMockRequest('/dashboard', '', token);
    const res = handleAuthMiddleware(req);

    expect(res.status).toBe(200);
  });

  it('redirects away from auth page (/login) to /dashboard when user is already authenticated with fresh token', () => {
    const freshPayload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    const token = `header.${freshPayload}.sig`;

    const req = createMockRequest('/login', '', token);
    const res = handleAuthMiddleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location') || '';
    expect(location).toContain('/dashboard');
  });

  it('never intercepts /auth/* paths (preventing interstitial loop)', () => {
    const req = createMockRequest('/auth/refresh', '?next=%2Fdashboard');
    const res = handleAuthMiddleware(req);

    expect(res.status).toBe(200); // Continues without redirection
  });
});
