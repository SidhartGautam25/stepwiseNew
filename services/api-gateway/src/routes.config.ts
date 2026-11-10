import type { RouteAuthMode } from '@app/contracts';

export interface RouteConfig {
  id: string;
  prefix: string;
  target: string;
  authMode: RouteAuthMode;
  methods?: string[];
  isSse?: boolean;
  stripPrefix?: string;
  matcher?: (pathname: string, method: string) => boolean;
}

export function getGatewayRoutes(): RouteConfig[] {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4006';
  const catalogServiceUrl = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';
  const profileServiceUrl = process.env.PROFILE_SERVICE_URL || 'http://localhost:4004';
  const verificationServiceUrl = process.env.VERIFICATION_SERVICE_URL || 'http://localhost:4003';

  return [
    // --- 1. Public Auth Endpoints ---
    {
      id: 'auth-public-login',
      prefix: '/v1/auth/login',
      target: authServiceUrl,
      authMode: 'public',
      methods: ['POST', 'OPTIONS'],
    },
    {
      id: 'auth-public-signup',
      prefix: '/v1/auth/signup',
      target: authServiceUrl,
      authMode: 'public',
      methods: ['POST', 'OPTIONS'],
    },
    {
      id: 'auth-public-refresh',
      prefix: '/v1/auth/refresh',
      target: authServiceUrl,
      authMode: 'public',
      methods: ['POST', 'OPTIONS'],
    },
    {
      id: 'auth-public-oauth',
      prefix: '/v1/auth/oauth',
      target: authServiceUrl,
      authMode: 'public',
      matcher: (pathname) => pathname.startsWith('/v1/auth/oauth'),
    },
    {
      id: 'auth-public-confirm',
      prefix: '/v1/auth/confirm',
      target: authServiceUrl,
      authMode: 'public',
      methods: ['POST', 'OPTIONS'],
    },
    {
      id: 'auth-public-forgot',
      prefix: '/v1/auth/password/forgot',
      target: authServiceUrl,
      authMode: 'public',
      methods: ['POST', 'OPTIONS'],
    },

    // --- 2. Authenticated Auth Endpoints (JWT by default: logout, me, password/reset, password/change, admin/*) ---
    {
      id: 'auth-authenticated',
      prefix: '/v1/auth',
      target: authServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) => pathname.startsWith('/v1/auth'),
    },

    // --- 3. Profile, Progress, Enrollment, Activity & Live SSE (profile-service) ---
    {
      id: 'profile-live-sse',
      prefix: '/v1/live',
      target: profileServiceUrl,
      authMode: 'jwt',
      isSse: true,
      matcher: (pathname) => pathname.startsWith('/v1/live'),
    },
    {
      id: 'workshops-enroll-or-progress',
      prefix: '/v1/workshops',
      target: profileServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) =>
        /^\/v1\/workshops\/[^/]+\/(enroll|progress)$/.test(pathname) ||
        pathname.startsWith('/v1/progress'),
    },
    {
      id: 'profile-service-general',
      prefix: '/v1/profile',
      target: profileServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) =>
        pathname.startsWith('/v1/profile') ||
        pathname.startsWith('/v1/activity') ||
        pathname.startsWith('/v1/preferences'),
    },

    // --- 4. Catalog Service (workshops, gated chapters/steps, starters download & admin) ---
    {
      id: 'catalog-admin',
      prefix: '/v1/admin',
      target: catalogServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) => pathname.startsWith('/v1/admin'),
    },
    {
      id: 'catalog-content-webhook',
      prefix: '/v1/github/content-webhook',
      target: catalogServiceUrl,
      authMode: 'passthrough',
      methods: ['POST', 'OPTIONS'],
    },
    {
      id: 'catalog-gated-content',
      prefix: '/v1/workshops',
      target: catalogServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) =>
        /^\/v1\/workshops\/[^/]+\/(chapters(\/.*)?|starter)$/.test(pathname),
    },
    {
      id: 'starters-download-public',
      prefix: '/v1/starters',
      target: catalogServiceUrl,
      authMode: 'public',
      matcher: (pathname) =>
        /^\/v1\/starters\/[^/]+\/[^/]+\/download$/.test(pathname),
    },
    {
      id: 'starters-jwt',
      prefix: '/v1/starters',
      target: catalogServiceUrl,
      authMode: 'jwt',
      matcher: (pathname) => pathname.startsWith('/v1/starters'),
    },
    {
      id: 'catalog-workshops-public-get',
      prefix: '/v1/workshops',
      target: catalogServiceUrl,
      authMode: 'public',
      methods: ['GET', 'HEAD', 'OPTIONS'],
      matcher: (pathname, method) =>
        (pathname === '/v1/workshops' || /^\/v1\/workshops\/[^/]+$/.test(pathname)) &&
        !pathname.endsWith('/enroll') &&
        !pathname.endsWith('/progress') &&
        ['GET', 'HEAD', 'OPTIONS'].includes(method),
    },

    // --- 5. Passthrough Verification & Webhook Endpoints (verification-service) ---
    {
      id: 'verification-passthrough',
      prefix: '/v1/verify',
      target: verificationServiceUrl,
      authMode: 'passthrough',
      matcher: (pathname) => pathname.startsWith('/v1/verify'),
    },
    {
      id: 'github-webhook-passthrough',
      prefix: '/v1/github/webhook',
      target: verificationServiceUrl,
      authMode: 'passthrough',
      methods: ['POST', 'OPTIONS'],
    },
  ];
}

export function isBlockedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/internal/') ||
    pathname.startsWith('/.well-known/') ||
    pathname === '/internal' ||
    pathname === '/.well-known'
  );
}
