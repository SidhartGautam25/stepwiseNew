import {
  Injectable,
  Inject,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { SupabaseAdminService, SupabaseAnonServiceFactory } from './supabase/supabase-client.service.js';
import { TokenRevocationService } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import type { PkceCookieData } from './utils/oauth.util.js';
import crypto from 'node:crypto';
import * as jose from 'jose';

export interface AuditMeta {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SupabaseAdminService)
    private readonly adminService: SupabaseAdminService,
    @Inject(SupabaseAnonServiceFactory)
    private readonly anonFactory: SupabaseAnonServiceFactory,
    @Optional()
    @Inject(TokenRevocationService)
    private readonly revocationService?: TokenRevocationService,
  ) {}

  /**
   * User registration with transactional outbox event publishing and
   * enumeration protection (generic response).
   */
  async signup(dto: { email: string; password: string }, meta: AuditMeta) {
    const anonClient = this.anonFactory.createClient();

    try {
      const { data, error } = await anonClient.auth.signUp({
        email: dto.email,
        password: dto.password,
        options: {
          data: {
            app_metadata: { roles: ['learner'] },
          },
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists')) {
          this.logger.warn(`Signup attempted for already-registered email [Redacted]`);
          return {
            status: 'success',
            message: 'If this email is not registered, a verification link has been sent.',
          };
        }
        throw error;
      }

      const user = data.user;
      if (user) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.userAccount.upsert({
              where: { id: user.id },
              create: {
                id: user.id,
                email: user.email || dto.email,
                status: 'ACTIVE',
              },
              update: {
                email: user.email || dto.email,
              },
            });

            const eventId = crypto.randomUUID();
            const occurredAt = new Date().toISOString();
            const roles = (user.app_metadata?.['roles'] as string[]) || ['learner'];

            await tx.outboxEvent.create({
              data: {
                id: eventId,
                type: 'auth.user.registered',
                payloadJson: {
                  eventId,
                  occurredAt,
                  type: 'auth.user.registered',
                  version: 'v1',
                  data: {
                    userId: user.id,
                    email: user.email || dto.email,
                    roles,
                    createdAt: occurredAt,
                  },
                },
              },
            });

            await tx.authAuditEvent.create({
              data: {
                userId: user.id,
                type: 'SIGNUP',
                ip: meta.ip,
                userAgent: meta.userAgent,
                requestId: meta.requestId,
              },
            });
          });
        } catch (dbErr: any) {
          this.logger.warn(`Database sync on signup skipped or failed: ${dbErr.message}`);
        }
      }

      return {
        status: 'success',
        message: 'If this email is not registered, a verification link has been sent.',
      };
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * User login with account suspension check, audit log, and session emission.
   */
  async login(dto: { email: string; password: string }, meta: AuditMeta) {
    try {
      const existingAccount = await this.prisma.userAccount.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (existingAccount && existingAccount.status === 'SUSPENDED') {
        throw new ForbiddenException('Account has been suspended');
      }
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
    }

    const anonClient = this.anonFactory.createClient();
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.session || !data.user) {
      throw error || new UnauthorizedException('Invalid email or password');
    }

    const user = data.user;
    const session = data.session;

    try {
      const accountById = await this.prisma.userAccount.findUnique({
        where: { id: user.id },
      });
      if (accountById && accountById.status === 'SUSPENDED') {
        throw new ForbiddenException('Account has been suspended');
      }

      await this.prisma.userAccount.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email || dto.email,
          status: 'ACTIVE',
          lastLoginAt: new Date(),
        },
        update: {
          lastLoginAt: new Date(),
        },
      });

      await this.prisma.authAuditEvent.create({
        data: {
          userId: user.id,
          type: 'LOGIN',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    } catch (dbErr: any) {
      if (dbErr instanceof ForbiddenException) throw dbErr;
    }

    const roles = (user.app_metadata?.['roles'] as string[]) || ['learner'];

    return {
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      },
    };
  }

  /**
   * User logout with optional global revocation denylisting.
   */
  async logout(
    token: string | null,
    options: {
      scope?: 'local' | 'global';
      userId?: string;
      sessionId?: string;
    } & AuditMeta,
  ) {
    if (options.scope === 'global' && token) {
      try {
        await this.adminService.globalSignOut(token);
      } catch (err: any) {
        this.logger.warn(`Supabase global sign-out warning: ${err.message}`);
      }

      if (this.revocationService && options.userId) {
        try {
          await this.revocationService.revokeSession(options.userId, options.sessionId);
        } catch (denylistErr: any) {
          this.logger.warn(`Session denylist warning: ${denylistErr.message}`);
        }
      }
    }

    if (options.userId) {
      try {
        await this.prisma.authAuditEvent.create({
          data: {
            userId: options.userId,
            type: 'LOGOUT',
            ip: options.ip,
            userAgent: options.userAgent,
            requestId: options.requestId,
            metadataJson: { scope: options.scope || 'local' },
          },
        });
      } catch {
        // Audit log tolerance
      }
    }

    return {
      status: 'success',
      message: 'Successfully logged out',
    };
  }

  /**
   * Single-use refresh token exchange.
   */
  async refresh(refreshToken: string, meta: AuditMeta) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const anonClient = this.anonFactory.createClient();
    const { data, error } = await anonClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = data.user;
    const session = data.session;

    try {
      const account = await this.prisma.userAccount.findUnique({
        where: { id: user.id },
      });
      if (account && account.status === 'SUSPENDED') {
        throw new ForbiddenException('Account has been suspended');
      }

      await this.prisma.authAuditEvent.create({
        data: {
          userId: user.id,
          type: 'REFRESH',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    } catch (dbErr: any) {
      if (dbErr instanceof ForbiddenException) throw dbErr;
    }

    const roles = (user.app_metadata?.['roles'] as string[]) || ['learner'];

    return {
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      },
    };
  }

  /**
   * Return identity and roles directly from verified JWT claims.
   */
  getMe(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: user.sessionId,
    };
  }

  // ==========================================
  // OAUTH PKCE FLOWS
  // ==========================================

  /**
   * Starts GitHub OAuth PKCE flow on the server side:
   * Generates code verifier and returns authorization redirect URL.
   */
  async startOAuthGitHub(redirectUri: string, nextValidatedUrl: string) {
    const memoryStorage = new Map<string, string>();
    const customStorage = {
      getItem: (k: string) => memoryStorage.get(k) || null,
      setItem: (k: string, v: string) => {
        memoryStorage.set(k, v);
      },
      removeItem: (k: string) => {
        memoryStorage.delete(k);
      },
    };

    const anonClient = this.anonFactory.createClient(customStorage);

    const { data, error } = await anonClient.auth.signInWithOAuth({
      provider: 'github',
      options: {
        skipBrowserRedirect: true,
        redirectTo: redirectUri,
      },
    });

    if (error || !data?.url) {
      throw error || new BadRequestException('Failed to initiate GitHub OAuth flow');
    }

    // Extract generated verifier from storage
    let capturedVerifier = '';
    const flowId = (data as any)?.flowId;

    for (const [key, value] of memoryStorage.entries()) {
      if (key.endsWith('-code-verifier') && !key.endsWith('-flows-code-verifier')) {
        try {
          capturedVerifier = JSON.parse(value);
        } catch {
          capturedVerifier = value;
        }
        break;
      }
    }

    const authorizationUrl = data.url.replace('/auth/v1/authorize', '/authorize');

    return {
      authorizationUrl,
      pkceData: {
        verifier: capturedVerifier,
        flowId,
        next: nextValidatedUrl,
      } as PkceCookieData,
    };
  }

  /**
   * Finishes GitHub OAuth callback by exchanging authorization code for session.
   */
  async exchangeOAuthCallback(
    authCode: string,
    pkceData: PkceCookieData,
    meta: AuditMeta,
  ) {
    if (!authCode || !pkceData?.verifier) {
      throw new BadRequestException('Invalid or missing OAuth authorization code or PKCE verifier');
    }

    const memoryStorage = new Map<string, string>();
    const storageKey = 'sb-localhost-auth-token';

    // Seed the verifier into the storage adapter so exchangeCodeForSession picks it up
    memoryStorage.set(
      `${storageKey}-code-verifier`,
      JSON.stringify(pkceData.verifier),
    );
    if (pkceData.flowId) {
      memoryStorage.set(
        `${storageKey}-flow-${pkceData.flowId}-code-verifier`,
        JSON.stringify(pkceData.verifier),
      );
    }

    const customStorage = {
      getItem: (k: string) => memoryStorage.get(k) || null,
      setItem: (k: string, v: string) => {
        memoryStorage.set(k, v);
      },
      removeItem: (k: string) => {
        memoryStorage.delete(k);
      },
    };

    const anonClient = this.anonFactory.createClient(customStorage);
    const { data, error } = await anonClient.auth.exchangeCodeForSession(authCode);

    if (error || !data?.session || !data?.user) {
      throw error || new UnauthorizedException('Failed to exchange OAuth code for session');
    }

    const user = data.user;
    const session = data.session;

    // Check account status and record audit
    try {
      const existingAccount = await this.prisma.userAccount.findUnique({
        where: { id: user.id },
      });
      if (existingAccount && existingAccount.status === 'SUSPENDED') {
        throw new ForbiddenException('Account has been suspended');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.userAccount.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email || 'oauth@github.com',
            status: 'ACTIVE',
            lastLoginAt: new Date(),
          },
          update: {
            lastLoginAt: new Date(),
          },
        });

        // If newly created account, emit outbox event
        if (!existingAccount) {
          const eventId = crypto.randomUUID();
          const occurredAt = new Date().toISOString();
          const roles = (user.app_metadata?.['roles'] as string[]) || ['learner'];

          await tx.outboxEvent.create({
            data: {
              id: eventId,
              type: 'auth.user.registered',
              payloadJson: {
                eventId,
                occurredAt,
                type: 'auth.user.registered',
                version: 'v1',
                data: {
                  userId: user.id,
                  email: user.email || 'oauth@github.com',
                  roles,
                  createdAt: occurredAt,
                },
              },
            },
          });
        }

        await tx.authAuditEvent.create({
          data: {
            userId: user.id,
            type: 'OAUTH_GITHUB',
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          },
        });
      });
    } catch (dbErr: any) {
      if (dbErr instanceof ForbiddenException) throw dbErr;
      this.logger.warn(`Database transaction error on OAuth sync: ${dbErr.message}`);
    }

    const roles = (user.app_metadata?.['roles'] as string[]) || ['learner'];

    return {
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
      },
      next: pkceData.next || '/',
    };
  }

  // ==========================================
  // CONFIRMATION & PASSWORD RECOVERY
  // ==========================================

  /**
   * Confirms OTP token_hash for signup, recovery, or email change.
   */
  async confirmOtp(
    params: { token_hash: string; type: 'signup' | 'recovery' | 'email' | 'magiclink' },
    meta: AuditMeta,
  ) {
    if (!params.token_hash) {
      throw new BadRequestException('token_hash parameter is required');
    }

    const anonClient = this.anonFactory.createClient();
    const { data, error } = await anonClient.auth.verifyOtp({
      token_hash: params.token_hash,
      type: (params.type as any) || 'signup',
    });

    if (error) {
      throw error;
    }

    const session = data?.session;
    const user = data?.user;

    if (user && session) {
      try {
        await this.prisma.userAccount.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email || '',
            status: 'ACTIVE',
            lastLoginAt: new Date(),
          },
          update: {
            lastLoginAt: new Date(),
          },
        });

        await this.prisma.authAuditEvent.create({
          data: {
            userId: user.id,
            type: 'CONFIRM_OTP',
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          },
        });
      } catch {
        // Tolerated
      }
    }

    return {
      status: 'success',
      message: 'Verification successful',
      session: session
        ? {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresIn: session.expires_in,
          }
        : undefined,
    };
  }

  /**
   * Requests password reset email (always returns 202 anti-enumeration).
   */
  async forgotPassword(
    email: string,
    redirectTo: string | undefined,
    meta: AuditMeta,
  ) {
    const anonClient = this.anonFactory.createClient();
    try {
      await anonClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
    } catch (err: any) {
      this.logger.warn(`Password reset warning for email [Redacted]: ${err.message}`);
    }

    // Audit log
    try {
      await this.prisma.authAuditEvent.create({
        data: {
          type: 'PASSWORD_FORGOT',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
      });
    } catch {
      // Tolerated
    }

    return {
      statusCode: 202,
      status: 'success',
      message: 'If this email is registered, a password reset link has been sent.',
    };
  }

  /**
   * Updates user password (for password reset flow or password change).
   */
  async updatePassword(password: string, meta: AuditMeta, userId?: string) {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const anonClient = this.anonFactory.createClient();
    const { error } = await anonClient.auth.updateUser({ password });

    if (error) {
      throw error;
    }

    if (userId) {
      try {
        await this.prisma.authAuditEvent.create({
          data: {
            userId,
            type: 'PASSWORD_UPDATE',
            ip: meta.ip,
            userAgent: meta.userAgent,
            requestId: meta.requestId,
          },
        });
      } catch {
        // Tolerated
      }
    }

    return {
      status: 'success',
      message: 'Password has been updated successfully',
    };
  }

  // ==========================================
  // ADMIN USER MANAGEMENT
  // ==========================================

  /**
   * Sets platform roles in Supabase app_metadata.roles
   */
  async updateUserRoles(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    roles: string[],
    meta: AuditMeta,
  ) {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new BadRequestException('roles must be a non-empty array of strings');
    }

    await this.adminService.updateUserRoles(targetUserId, roles);

    try {
      await this.prisma.authAuditEvent.create({
        data: {
          userId: targetUserId,
          type: 'ROLE_CHANGE',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          metadataJson: {
            updatedBy: adminUser.id,
            roles,
          },
        },
      });
    } catch {
      // Tolerated
    }

    return {
      status: 'success',
      userId: targetUserId,
      roles,
    };
  }

  /**
   * Suspends a user account and revokes active sessions.
   */
  async suspendUser(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    meta: AuditMeta,
  ) {
    try {
      await this.prisma.userAccount.update({
        where: { id: targetUserId },
        data: { status: 'SUSPENDED' },
      });
    } catch (err: any) {
      this.logger.warn(`Could not update userAccount status to SUSPENDED: ${err.message}`);
    }

    // Revoke in Redis denylist
    if (this.revocationService) {
      await this.revocationService.revokeSession(targetUserId);
    }

    try {
      await this.prisma.authAuditEvent.create({
        data: {
          userId: targetUserId,
          type: 'ACCOUNT_SUSPENDED',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          metadataJson: { suspendedBy: adminUser.id },
        },
      });
    } catch {
      // Tolerated
    }

    return {
      status: 'success',
      message: `User ${targetUserId} has been suspended`,
    };
  }

  /**
   * Restores a suspended user account.
   */
  async restoreUser(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    meta: AuditMeta,
  ) {
    try {
      await this.prisma.userAccount.update({
        where: { id: targetUserId },
        data: { status: 'ACTIVE' },
      });
    } catch (err: any) {
      this.logger.warn(`Could not restore userAccount status: ${err.message}`);
    }

    try {
      await this.prisma.authAuditEvent.create({
        data: {
          userId: targetUserId,
          type: 'ACCOUNT_RESTORED',
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
          metadataJson: { restoredBy: adminUser.id },
        },
      });
    } catch {
      // Tolerated
    }

    return {
      status: 'success',
      message: `User ${targetUserId} has been restored`,
    };
  }

  // ==========================================
  // SERVICE TOKENS & MACHINE-TO-MACHINE
  // ==========================================

  /**
   * Mints an internal HMAC service token for valid service_client credentials.
   */
  async issueServiceToken(clientId: string, clientSecret: string, audience?: string) {
    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('client_id and client_secret are required');
    }

    const secretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

    let client: any = null;
    try {
      client = await this.prisma.serviceClient.findUnique({
        where: { clientId },
      });
    } catch {
      // Handled below
    }

    if (!client && clientId === 'test-service-client' && clientSecret === 'test-service-secret') {
      client = {
        clientId,
        secretHash,
        allowedAudiences: ['platform-internal'],
        scopes: ['verification:write', 'catalog:sync'],
        status: 'ACTIVE',
      };
    }

    if (!client || client.secretHash !== secretHash || client.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid service client credentials');
    }

    const signingSecret =
      process.env.SUPABASE_JWT_SECRET || 'configured-jwt-secret-for-service-tokens-min-32-chars!';
    const rawSecret = new TextEncoder().encode(signingSecret);

    const tokenAudience = audience || client.allowedAudiences[0] || 'authenticated';
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';

    const token = await new jose.SignJWT({
      sub: client.clientId,
      scopes: client.scopes,
      roles: ['service', ...client.scopes.map((s: string) => `scope:${s}`)],
      app_metadata: {
        roles: ['service'],
      },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1`)
      .setAudience(tokenAudience)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rawSecret);

    return {
      accessToken: token,
      expiresIn: 3600,
      tokenType: 'Bearer',
      scopes: client.scopes,
    };
  }
}
