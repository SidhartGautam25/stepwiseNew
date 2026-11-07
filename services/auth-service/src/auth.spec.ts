import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { AuthExceptionFilter } from './filters/auth-exception.filter.js';
import { setAuthCookies, clearAuthCookies, getCookieNames } from './utils/cookie.util.js';
import { validateNextRedirect, setPkceCookie, extractPkceCookie } from './utils/oauth.util.js';
import { TokenRevocationService } from '@app/auth';
import { ForbiddenException, UnauthorizedException, BadRequestException, HttpStatus } from '@nestjs/common';
import * as jose from 'jose';

describe('AuthService Core', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockAdminService: any;
  let mockAnonFactory: any;
  let mockAnonClient: any;
  let revocationService: TokenRevocationService;

  beforeEach(() => {
    mockAnonClient = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        refreshSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        exchangeCodeForSession: vi.fn(),
        verifyOtp: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
      },
    };

    mockAnonFactory = {
      createClient: vi.fn().mockImplementation((customStorage) => {
        // If customStorage is provided, simulate capturing verifier on signInWithOAuth
        if (customStorage) {
          return {
            auth: {
              ...mockAnonClient.auth,
              signInWithOAuth: vi.fn().mockImplementation(async () => {
                await customStorage.setItem(
                  'sb-localhost-auth-token-code-verifier',
                  JSON.stringify('test-pkce-verifier-12345'),
                );
                return {
                  data: {
                    provider: 'github',
                    url: 'https://github.com/login/oauth/authorize?test=true',
                    flowId: 'flow-abc',
                  },
                  error: null,
                };
              }),
            },
          };
        }
        return mockAnonClient;
      }),
    };

    mockAdminService = {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      updateUserRoles: vi.fn().mockResolvedValue(undefined),
      globalSignOut: vi.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      userAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      serviceClient: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      authAuditEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    revocationService = new TokenRevocationService();

    authService = new AuthService(
      mockPrisma,
      mockAdminService,
      mockAnonFactory,
      revocationService,
    );
  });

  describe('signup', () => {
    it('returns generic message for successful registration and records outbox event', async () => {
      mockAnonClient.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'newuser@handrail.dev',
            app_metadata: { roles: ['learner'] },
          },
        },
        error: null,
      });

      const res = await authService.signup(
        { email: 'newuser@handrail.dev', password: 'Password123!' },
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(res.message).toContain('If this email is not registered');
      expect(mockPrisma.userAccount.upsert).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'auth.user.registered',
          }),
        }),
      );
    });

    it('enforces anti-enumeration: returns identical generic message when email is already registered', async () => {
      mockAnonClient.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const res = await authService.signup(
        { email: 'existing@handrail.dev', password: 'Password123!' },
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(res.message).toContain('If this email is not registered');
    });
  });

  describe('login', () => {
    it('successfully logs in, logs audit event, and returns user session', async () => {
      mockAnonClient.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'learner@handrail.dev',
            app_metadata: { roles: ['learner'] },
          },
          session: {
            access_token: 'fake-access-token',
            refresh_token: 'fake-refresh-token',
            expires_in: 900,
          },
        },
        error: null,
      });

      const result = await authService.login(
        { email: 'learner@handrail.dev', password: 'Password123!' },
        { ip: '127.0.0.1', userAgent: 'test-agent' },
      );

      expect(result.user.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.user.roles).toEqual(['learner']);
      expect(result.session.accessToken).toBe('fake-access-token');
      expect(result.session.refreshToken).toBe('fake-refresh-token');
    });

    it('rejects suspended accounts with ForbiddenException', async () => {
      mockPrisma.userAccount.findUnique.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'suspended@handrail.dev',
        status: 'SUSPENDED',
      });

      await expect(
        authService.login(
          { email: 'suspended@handrail.dev', password: 'Password123!' },
          { ip: '127.0.0.1' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('logout', () => {
    it('revokes session on global logout and adds to denylist', async () => {
      const result = await authService.logout('test-jwt-token', {
        scope: 'global',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: 'session-xyz',
      });

      expect(result.status).toBe('success');
      expect(mockAdminService.globalSignOut).toHaveBeenCalledWith('test-jwt-token');

      const isRevoked = await revocationService.isRevoked({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: 'session-xyz',
      });
      expect(isRevoked).toBe(true);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token and returns new session', async () => {
      mockAnonClient.auth.refreshSession.mockResolvedValue({
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'refreshed@handrail.dev',
            app_metadata: { roles: ['learner'] },
          },
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 900,
          },
        },
        error: null,
      });

      const res = await authService.refresh('old-refresh-token', { ip: '127.0.0.1' });
      expect(res.session.accessToken).toBe('new-access-token');
      expect(res.session.refreshToken).toBe('new-refresh-token');
    });
  });

  describe('OAuth GitHub PKCE flow', () => {
    it('starts GitHub OAuth flow and returns verifier + authorization URL', async () => {
      const res = await authService.startOAuthGitHub(
        'http://localhost:4000/v1/auth/oauth/callback',
        '/workshops',
      );

      expect(res.authorizationUrl).toContain('github.com');
      expect(res.pkceData.verifier).toBe('test-pkce-verifier-12345');
      expect(res.pkceData.next).toBe('/workshops');
    });

    it('exchanges OAuth code with captured verifier and emits session', async () => {
      mockAnonClient.auth.exchangeCodeForSession.mockResolvedValue({
        data: {
          user: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'oauth.developer@handrail.dev',
            app_metadata: { roles: ['learner'] },
          },
          session: {
            access_token: 'oauth-access-token',
            refresh_token: 'oauth-refresh-token',
            expires_in: 900,
          },
        },
        error: null,
      });

      const res = await authService.exchangeOAuthCallback(
        'oauth-auth-code-123',
        {
          verifier: 'test-pkce-verifier-12345',
          flowId: 'flow-abc',
          next: '/workshops/react',
        },
        { ip: '127.0.0.1' },
      );

      expect(res.user.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(res.session.accessToken).toBe('oauth-access-token');
      expect(res.next).toBe('/workshops/react');
    });
  });

  describe('Confirmation & Password Recovery', () => {
    it('confirmOtp verifies token_hash and emits session', async () => {
      mockAnonClient.auth.verifyOtp.mockResolvedValue({
        data: {
          user: { id: '550e8400-e29b-41d4-a716-446655440000', email: 'verified@handrail.dev' },
          session: {
            access_token: 'verified-access-token',
            refresh_token: 'verified-refresh-token',
            expires_in: 900,
          },
        },
        error: null,
      });

      const res = await authService.confirmOtp(
        { token_hash: 'otp-token-hash-123', type: 'signup' },
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(res.session?.accessToken).toBe('verified-access-token');
    });

    it('forgotPassword always returns 202 Accepted (anti-enumeration)', async () => {
      mockAnonClient.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

      const res = await authService.forgotPassword(
        'user@handrail.dev',
        'http://localhost:3000/reset-password',
        { ip: '127.0.0.1' },
      );

      expect(res.statusCode).toBe(202);
      expect(res.status).toBe('success');
    });

    it('updatePassword rejects passwords shorter than 8 characters', async () => {
      await expect(
        authService.updatePassword('short', { ip: '127.0.0.1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Admin User & Role Management', () => {
    const adminUser = {
      id: 'admin-uuid-0000-0000-0000-000000000000',
      email: 'admin@handrail.dev',
      roles: ['admin'],
    };

    it('updates user platform roles in Supabase app_metadata.roles', async () => {
      const res = await authService.updateUserRoles(
        adminUser,
        '550e8400-e29b-41d4-a716-446655440000',
        ['admin', 'content_creator'],
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(mockAdminService.updateUserRoles).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        ['admin', 'content_creator'],
      );
    });

    it('suspends user account and revokes active session', async () => {
      const res = await authService.suspendUser(
        adminUser,
        '550e8400-e29b-41d4-a716-446655440000',
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(mockPrisma.userAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'SUSPENDED' },
        }),
      );

      const isRevoked = await revocationService.isRevoked({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(isRevoked).toBe(true);
    });

    it('restores suspended user account', async () => {
      const res = await authService.restoreUser(
        adminUser,
        '550e8400-e29b-41d4-a716-446655440000',
        { ip: '127.0.0.1' },
      );

      expect(res.status).toBe('success');
      expect(mockPrisma.userAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ACTIVE' },
        }),
      );
    });
  });

  describe('Service Tokens (/internal/service-token)', () => {
    it('mints signed JWT with service role and scopes for valid client', async () => {
      const res = await authService.issueServiceToken(
        'test-service-client',
        'test-service-secret',
        'platform-internal',
      );

      expect(res.accessToken).toBeDefined();
      expect(res.expiresIn).toBe(3600);
      expect(res.tokenType).toBe('Bearer');

      // Verify minted JWT claims
      const secret =
        process.env.SUPABASE_JWT_SECRET || 'configured-jwt-secret-for-service-tokens-min-32-chars!';
      const { payload } = await jose.jwtVerify(res.accessToken, new TextEncoder().encode(secret));

      expect(payload.sub).toBe('test-service-client');
      expect(payload.aud).toBe('platform-internal');
      expect(payload['roles']).toContain('service');
      expect(payload['scopes']).toContain('verification:write');
    });

    it('rejects invalid service credentials with UnauthorizedException', async () => {
      await expect(
        authService.issueServiceToken('unknown-client', 'wrong-secret'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

describe('Open-Redirect & PKCE Cookie Protection', () => {
  it('allows safe relative redirect paths', () => {
    expect(validateNextRedirect('/workshops')).toBe('/workshops');
    expect(validateNextRedirect('/profile/settings')).toBe('/profile/settings');
  });

  it('rejects protocol-relative open-redirect attempts', () => {
    expect(validateNextRedirect('//attacker.com')).toBe('/');
    expect(validateNextRedirect('/\\attacker.com')).toBe('/');
  });

  it('rejects disallowed absolute URLs', () => {
    expect(validateNextRedirect('https://evil-phishing-site.com/login')).toBe('/');
  });

  it('allows allowlisted absolute web origin URLs', () => {
    expect(validateNextRedirect('http://localhost:3000/dashboard')).toBe(
      'http://localhost:3000/dashboard',
    );
  });

  it('serializes and extracts PKCE cookie safely', () => {
    let capturedCookie = '';
    const mockRes = {
      cookie: (name: string, val: string) => {
        capturedCookie = val;
      },
    } as any;

    setPkceCookie(mockRes, {
      verifier: 'pkce-test-verifier',
      flowId: 'flow-123',
      next: '/workshops',
    });

    const mockReq = {
      cookies: { hr_pkce: capturedCookie },
      headers: {},
    } as any;

    const extracted = extractPkceCookie(mockReq);
    expect(extracted).not.toBeNull();
    expect(extracted?.verifier).toBe('pkce-test-verifier');
    expect(extracted?.next).toBe('/workshops');
  });
});

describe('Cookie Utilities', () => {
  it('correctly sets HttpOnly cookies on response', () => {
    const cookiesSet: Record<string, { value: string; options: any }> = {};
    const mockRes = {
      cookie: (name: string, value: string, options: any) => {
        cookiesSet[name] = { value, options };
      },
    } as any;

    setAuthCookies(mockRes, {
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresIn: 900,
    });

    const names = getCookieNames();
    expect(cookiesSet[names.accessToken]).toBeDefined();
    expect(cookiesSet[names.accessToken].value).toBe('access-123');
    expect(cookiesSet[names.accessToken].options.httpOnly).toBe(true);
    expect(cookiesSet[names.accessToken].options.path).toBe('/');

    expect(cookiesSet[names.refreshToken]).toBeDefined();
    expect(cookiesSet[names.refreshToken].value).toBe('refresh-456');
    expect(cookiesSet[names.refreshToken].options.httpOnly).toBe(true);
    expect(cookiesSet[names.refreshToken].options.path).toBe('/v1/auth');
  });

  it('correctly clears cookies with maxAge: 0', () => {
    const cookiesSet: Record<string, { value: string; options: any }> = {};
    const mockRes = {
      cookie: (name: string, value: string, options: any) => {
        cookiesSet[name] = { value, options };
      },
    } as any;

    clearAuthCookies(mockRes);

    const names = getCookieNames();
    expect(cookiesSet[names.accessToken].options.maxAge).toBe(0);
    expect(cookiesSet[names.refreshToken].options.maxAge).toBe(0);
  });
});

describe('AuthExceptionFilter', () => {
  let filter: AuthExceptionFilter;

  beforeEach(() => {
    filter = new AuthExceptionFilter();
  });

  function createMockHost(responseJson: (status: number, body: any) => void) {
    const req = {
      headers: { 'x-correlation-id': 'test-corr-id' },
    };
    const res = {
      status: (statusCode: number) => ({
        json: (body: any) => responseJson(statusCode, body),
      }),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
  }

  it('maps Supabase Invalid login credentials to 401 INVALID_CREDENTIALS', () => {
    let capturedStatus = 0;
    let capturedBody: any;

    const host = createMockHost((status, body) => {
      capturedStatus = status;
      capturedBody = body;
    });

    filter.catch({ message: 'Invalid login credentials', status: 400 }, host);

    expect(capturedStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(capturedBody.code).toBe('INVALID_CREDENTIALS');
    expect(capturedBody.message).toBe('Invalid email or password');
  });

  it('maps Supabase rate limit to 429 RATE_LIMITED', () => {
    let capturedStatus = 0;
    let capturedBody: any;

    const host = createMockHost((status, body) => {
      capturedStatus = status;
      capturedBody = body;
    });

    filter.catch({ message: 'Over email send rate limit', status: 429 }, host);

    expect(capturedStatus).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(capturedBody.code).toBe('RATE_LIMITED');
  });

  it('maps weak password to 400 WEAK_PASSWORD', () => {
    let capturedStatus = 0;
    let capturedBody: any;

    const host = createMockHost((status, body) => {
      capturedStatus = status;
      capturedBody = body;
    });

    filter.catch({ message: 'Password should be at least 6 characters' }, host);

    expect(capturedStatus).toBe(HttpStatus.BAD_REQUEST);
    expect(capturedBody.code).toBe('WEAK_PASSWORD');
  });

  it('maps ACCOUNT_SUSPENDED to 403 ACCOUNT_SUSPENDED', () => {
    let capturedStatus = 0;
    let capturedBody: any;

    const host = createMockHost((status, body) => {
      capturedStatus = status;
      capturedBody = body;
    });

    filter.catch({ code: 'account_suspended', message: 'Account has been suspended' }, host);

    expect(capturedStatus).toBe(HttpStatus.FORBIDDEN);
    expect(capturedBody.code).toBe('ACCOUNT_SUSPENDED');
  });
});
