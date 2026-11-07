import { NextResponse, type NextRequest } from 'next/server';
import * as jose from 'jose';
import { isProtectedRoute, isAuthPage, validateRedirectTarget } from './routes';
import { env } from '@/config/env';

export function handleAuthMiddleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const originalPathAndQuery = `${pathname}${search}`;

  // 1. Never intercept /auth/* routes to prevent interstitial loops
  if (pathname.startsWith('/auth/')) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // 2. Read access cookie
  const cookieName = env.AUTH_ACCESS_COOKIE_NAME;
  const token =
    request.cookies.get(cookieName)?.value ||
    request.cookies.get('hr_at')?.value ||
    request.cookies.get('__Secure-hr_at')?.value;

  // 3. Inspect token expiration as a freshness hint (no verify needed at middleware)
  let isFresh = false;
  if (token) {
    try {
      const decoded = jose.decodeJwt(token);
      if (decoded.exp && decoded.exp * 1000 > Date.now()) {
        isFresh = true;
      }
    } catch {
      isFresh = false;
    }
  }

  // 4. Protected routes check
  if (isProtectedRoute(pathname)) {
    if (!isFresh) {
      // Redirect to client-side refresh interstitial with return destination
      const refreshUrl = new URL('/auth/refresh', request.url);
      refreshUrl.searchParams.set('next', originalPathAndQuery);
      return NextResponse.redirect(refreshUrl);
    }
  }

  // 5. Auth pages check (if already authenticated, redirect away)
  if (isAuthPage(pathname) && isFresh) {
    const rawNext = request.nextUrl.searchParams.get('next');
    const validatedNext = validateRedirectTarget(rawNext, '/dashboard');
    return NextResponse.redirect(new URL(validatedNext, request.url));
  }

  // 6. Forward requested path in header for downstream Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
