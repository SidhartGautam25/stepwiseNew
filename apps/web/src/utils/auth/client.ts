import { env } from '@/config/env';
import { emitAuthEvent } from './events';
import { validateRedirectTarget } from './routes';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@app/contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  roles: string[];
  sessionId?: string;
}

export interface Session {
  user: SessionUser;
  expiresAt: number; // Unix timestamp in seconds
}

// Module-level in-flight promise for single-flight refresh across concurrent requests
let singleFlightRefreshPromise: Promise<boolean> | null = null;

const BYPASS_REFRESH_PATHS = [
  '/v1/auth/login',
  '/v1/auth/signup',
  '/v1/auth/refresh',
  '/v1/auth/confirm',
  '/v1/auth/password/forgot',
];

interface ApiFetchOptions extends RequestInit {
  _isRetry?: boolean;
}

/**
 * Browser-side fetch wrapper:
 * - Base URL from NEXT_PUBLIC_API_URL
 * - Automatically includes credentials: 'include'
 * - Injects X-Requested-With: handrail header
 * - Single-flight refresh on 401 with exactly one retry
 */
export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  const headers = new Headers(init.headers || {});
  headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);

  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const fetchOptions: RequestInit = {
    ...init,
    credentials: 'include',
    headers,
  };

  const response = await fetch(fullUrl, fetchOptions);

  if (response.ok) {
    // Check if empty response (e.g. 204 or empty 200)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return {} as T;
  }

  // Handle 401 with single-flight refresh
  const isBypassPath = BYPASS_REFRESH_PATHS.some((p) => cleanPath.startsWith(p));
  if (response.status === 401 && !isBypassPath && !init._isRetry) {
    const refreshed = await executeSingleFlightRefresh();

    if (refreshed) {
      // Retry the original request exactly once
      return apiFetch<T>(path, {
        ...init,
        _isRetry: true,
      });
    }

    emitAuthEvent('SESSION_EXPIRED');
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  }

  // Parse structured error response
  let errorCode = 'REQUEST_FAILED';
  let errorMessage = `Request failed with status ${response.status}`;
  let retryAfter: number | undefined;

  const retryAfterHeader = response.headers.get('retry-after');
  if (retryAfterHeader) {
    retryAfter = parseInt(retryAfterHeader, 10);
  }

  try {
    const errorBody = await response.json();
    if (errorBody && typeof errorBody === 'object') {
      errorCode = errorBody.code || errorBody.error || errorCode;
      errorMessage = errorBody.message || errorMessage;
    }
  } catch {
    // Non-JSON error body fallback
  }

  throw new ApiError(response.status, errorCode, errorMessage, retryAfter);
}

/**
 * Executes a single-flight token refresh call.
 * If multiple requests 401 concurrently, all share this exact same in-flight promise.
 */
export async function executeSingleFlightRefresh(): Promise<boolean> {
  if (singleFlightRefreshPromise) {
    return singleFlightRefreshPromise;
  }

  singleFlightRefreshPromise = (async () => {
    try {
      const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return false;
      }

      emitAuthEvent('TOKEN_REFRESHED');
      return true;
    } catch {
      return false;
    } finally {
      singleFlightRefreshPromise = null;
    }
  })();

  return singleFlightRefreshPromise;
}

// ==========================================
// AUTH CALLS
// ==========================================

export async function login(body: { email: string; password: string }) {
  return apiFetch<{ user: SessionUser; session: { expiresIn: number } }>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function signup(body: { email: string; password: string }) {
  return apiFetch<{ status: string; message: string }>('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function logout(options?: { global?: boolean }) {
  const scope = options?.global ? 'global' : 'local';
  return apiFetch<{ status: string; message: string }>(`/v1/auth/logout?scope=${scope}`, {
    method: 'POST',
  });
}

export async function forgotPassword(body: { email: string; redirectTo?: string }) {
  return apiFetch<{ status: string; message: string }>('/v1/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function resetPassword(body: { password: string }) {
  return apiFetch<{ status: string; message: string }>('/v1/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function changePassword(body: { currentPassword?: string; newPassword: string }) {
  return apiFetch<{ status: string; message: string }>('/v1/auth/password/change', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function confirm(body: { token_hash: string; type: string }) {
  return apiFetch<{ status: string; message: string }>('/v1/auth/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Fetches the current session via GET /v1/auth/me.
 * Returns Session or null if unauthenticated.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const user = await apiFetch<SessionUser>('/v1/auth/me', {
      method: 'GET',
    });

    if (!user || !user.id) {
      return null;
    }

    // Default 15 minutes expiresAt if token lifetime is not passed in header
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;

    return {
      user: {
        ...user,
        displayName: user.displayName || user.email.split('@')[0],
      },
      expiresAt,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    return null;
  }
}

/**
 * Navigates browser to initiate GitHub OAuth with PKCE flow.
 */
export function startGitHubOAuth(next?: string) {
  const validatedNext = validateRedirectTarget(next);
  const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/auth/oauth/github/start?next=${encodeURIComponent(validatedNext)}`;
  window.location.assign(url);
}
