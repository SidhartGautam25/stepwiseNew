export const PROTECTED_PREFIXES = ['/dashboard', '/settings'] as const;

export const AUTH_PAGES = ['/login', '/signup', '/forgot-password'] as const;

export const DEFAULT_AUTHENTICATED_REDIRECT = '/dashboard';

/**
 * Validates redirect targets (next, redirectTo) taken from query parameters or user input.
 * Strictly enforces:
 * - Must be a same-origin relative path starting with a single '/'
 * - Must not start with '//' (protocol-relative attacks)
 * - Must not contain backslashes '\'
 * - Must not contain a scheme (e.g. 'http:', 'https:', 'javascript:')
 * Falls back to /dashboard if validation fails.
 */
export function validateRedirectTarget(target?: string | null, fallback = DEFAULT_AUTHENTICATED_REDIRECT): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();

  // Must start with '/' and not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Must not contain any backslashes
  if (trimmed.includes('\\')) {
    return fallback;
  }

  // Must not contain any URI scheme before the path
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}
