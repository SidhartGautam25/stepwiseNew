import { describe, it, expect, beforeAll } from 'vitest';
import * as jose from 'jose';
import { SupabaseJwtVerifier } from '@app/auth';
import { CsrfProtectionMiddleware } from './csrf.middleware.js';
import { getGatewayRoutes, isBlockedRoute } from './routes.config.js';
import { AUTH_COOKIES } from '@app/contracts';

describe('Gateway Route Table & Policy Enforcement', () => {
  it('correctly declares route prefixes, targets, and auth modes', () => {
    const routes = getGatewayRoutes();

    // Verify Public Auth routes
    const loginRoute = routes.find((r) => r.prefix === '/v1/auth/login');
    expect(loginRoute).toBeDefined();
    expect(loginRoute?.authMode).toBe('public');

    const signupRoute = routes.find((r) => r.prefix === '/v1/auth/signup');
    expect(signupRoute).toBeDefined();
    expect(signupRoute?.authMode).toBe('public');

    // Verify Mutating workshops routes route to profile-service with JWT
    const enrollRoute = routes.find((r) => r.id === 'workshops-enroll-or-progress');
    expect(enrollRoute).toBeDefined();
    expect(enrollRoute?.authMode).toBe('jwt');
    expect(enrollRoute?.matcher?.('/v1/workshops/react-workshop/enroll', 'POST')).toBe(true);

    // Verify Public catalog route
    const catalogRoute = routes.find((r) => r.id === 'catalog-workshops-public-get');
    expect(catalogRoute).toBeDefined();
    expect(catalogRoute?.authMode).toBe('public');
    expect(catalogRoute?.matcher?.('/v1/workshops', 'GET')).toBe(true);
    expect(catalogRoute?.matcher?.('/v1/workshops/react-workshop', 'GET')).toBe(true);
    // Mutating request to catalog route is not matched
    expect(catalogRoute?.matcher?.('/v1/workshops', 'POST')).toBe(false);

    // Verify Passthrough verification and webhook routes
    const verifyRoute = routes.find((r) => r.id === 'verification-passthrough');
    expect(verifyRoute).toBeDefined();
    expect(verifyRoute?.authMode).toBe('passthrough');

    const webhookRoute = routes.find((r) => r.id === 'github-webhook-passthrough');
    expect(webhookRoute).toBeDefined();
    expect(webhookRoute?.authMode).toBe('passthrough');
  });

  it('strictly blocks /internal/* and /.well-known/* routes from being routed', () => {
    expect(isBlockedRoute('/internal/content')).toBe(true);
    expect(isBlockedRoute('/internal/service-token')).toBe(true);
    expect(isBlockedRoute('/.well-known/jwks.json')).toBe(true);
    expect(isBlockedRoute('/v1/workshops')).toBe(false);
  });
});

describe('CSRF Protection Middleware', () => {
  let csrfMiddleware: CsrfProtectionMiddleware;

  beforeAll(() => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000';
    csrfMiddleware = new CsrfProtectionMiddleware();
  });

  function createMockReq(options: {
    method: string;
    origin?: string;
    referer?: string;
    cookie?: string;
    customHeader?: string;
    authorization?: string;
  }) {
    const headers: Record<string, string> = {};
    if (options.origin) headers['origin'] = options.origin;
    if (options.referer) headers['referer'] = options.referer;
    if (options.cookie) headers['cookie'] = options.cookie;
    if (options.customHeader) headers['x-requested-with'] = options.customHeader;
    if (options.authorization) headers['authorization'] = options.authorization;

    return {
      method: options.method,
      headers,
    } as any;
  }

  it('allows safe methods (GET, HEAD, OPTIONS) without CSRF headers', () => {
    let nextCalled = false;
    const req = createMockReq({
      method: 'GET',
      cookie: `${AUTH_COOKIES.ACCESS_TOKEN}=fake-token`,
    });
    csrfMiddleware.use(req, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('allows non-GET Bearer-only requests to skip CSRF check', () => {
    let nextCalled = false;
    const req = createMockReq({
      method: 'POST',
      authorization: 'Bearer token-123',
      // No cookie set
    });
    csrfMiddleware.use(req, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });

  it('rejects mutating cookie-authenticated request when X-Requested-With header is missing', () => {
    const req = createMockReq({
      method: 'POST',
      origin: 'http://localhost:3000',
      cookie: `${AUTH_COOKIES.ACCESS_TOKEN}=fake-token`,
      // Missing X-Requested-With
    });

    expect(() => csrfMiddleware.use(req, {} as any, () => {})).toThrow(
      /Missing or invalid X-Requested-With/i,
    );
  });

  it('rejects mutating cookie-authenticated request when Origin is not allowed', () => {
    const req = createMockReq({
      method: 'POST',
      origin: 'http://malicious-attacker.com',
      cookie: `${AUTH_COOKIES.ACCESS_TOKEN}=fake-token`,
      customHeader: 'handrail',
    });

    expect(() => csrfMiddleware.use(req, {} as any, () => {})).toThrow(
      /CSRF origin validation failed/i,
    );
  });

  it('allows mutating cookie-authenticated request when valid Origin and X-Requested-With are present', () => {
    let nextCalled = false;
    const req = createMockReq({
      method: 'POST',
      origin: 'http://localhost:3000',
      cookie: `${AUTH_COOKIES.ACCESS_TOKEN}=valid-cookie-token`,
      customHeader: 'handrail',
    });

    csrfMiddleware.use(req, {} as any, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});

describe('Gateway Token Extraction and Verification Logic', () => {
  const secret = 'configured-jwt-secret-for-local-fallback-only-minimum-32-chars!';
  let verifier: SupabaseJwtVerifier;

  beforeAll(() => {
    verifier = new SupabaseJwtVerifier({
      supabaseJwtSecret: secret,
      audience: 'authenticated',
    });
  });

  it('successfully verifies token and populates AuthenticatedUser', async () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const token = await new jose.SignJWT({
      email: 'engineer@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(validUuid)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    const user = await verifier.verifyToken(token);
    expect(user.id).toBe(validUuid);
    expect(user.email).toBe('engineer@handrail.dev');
    expect(user.roles).toContain('learner');
  });

  it('rejects expired tokens', async () => {
    const expiredToken = await new jose.SignJWT({
      email: 'expired@handrail.dev',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('550e8400-e29b-41d4-a716-446655440000')
      .setAudience('authenticated')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(secret));

    await expect(verifier.verifyToken(expiredToken)).rejects.toThrow();
  });
});
