import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';
import type { AuthenticatedUser } from '@app/contracts';
import type { AuthModuleOptions, TokenStrategy } from './interfaces/token-strategy.interface.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ASYMMETRIC_ALGORITHMS = ['RS256', 'ES256'];

@Injectable()
export class SupabaseJwtVerifier implements TokenStrategy {
  readonly name = 'supabase-jwt';
  private readonly logger = new Logger(SupabaseJwtVerifier.name);

  private jwks: jose.JWTVerifyGetKey | null = null;
  private jwtSecret: Uint8Array | null = null;
  private jwksUri: string | null = null;
  private expectedIssuer: string | null = null;
  private expectedAudience: string = 'authenticated';
  private clockTolerance: number = 30; // 30 seconds skew tolerance

  constructor(options?: AuthModuleOptions) {
    if (options) {
      this.configure(options);
    } else {
      this.configureFromEnv();
    }
  }

  public configure(options: AuthModuleOptions) {
    const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
    const secret = options.supabaseJwtSecret || process.env.SUPABASE_JWT_SECRET;
    const customJwksUri = options.jwksUri || process.env.SUPABASE_JWKS_URI;

    this.expectedAudience = options.audience || 'authenticated';
    this.clockTolerance = Math.min(options.clockTolerance ?? 30, 30);

    if (options.jwks) {
      this.jwks = options.jwks;
      this.logger.log('Configured custom JWKS function');
    } else if (options.localJwks) {
      this.jwks = jose.createLocalJWKSet(options.localJwks);
      this.logger.log('Configured in-memory local JWKS set');
    } else if (customJwksUri) {
      this.jwksUri = customJwksUri;
      this.jwks = jose.createRemoteJWKSet(new URL(this.jwksUri));
      this.logger.log(`Initialized JWKS verifier with URL: ${this.jwksUri}`);
    } else if (supabaseUrl) {
      const cleanUrl = supabaseUrl.replace(/\/+$/, '');
      this.jwksUri = `${cleanUrl}/auth/v1/.well-known/jwks.json`;
      this.jwks = jose.createRemoteJWKSet(new URL(this.jwksUri));
      this.logger.log(`Initialized JWKS verifier with Supabase URL: ${this.jwksUri}`);
    }

    if (options.issuer) {
      this.expectedIssuer = options.issuer.replace(/\/+$/, '');
    } else if (supabaseUrl) {
      this.expectedIssuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
    }

    if (secret) {
      this.jwtSecret = new TextEncoder().encode(secret);
      this.logger.log('Configured opt-in HS256 JWT secret fallback');
    }
  }

  public configureFromEnv() {
    this.configure({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,
      jwksUri: process.env.SUPABASE_JWKS_URI,
      issuer: process.env.SUPABASE_ISSUER,
      audience: process.env.SUPABASE_AUDIENCE || 'authenticated',
      clockTolerance: 30,
    });
  }

  canHandle(token: string): boolean {
    return typeof token === 'string' && token.split('.').length === 3;
  }

  async validate(token: string): Promise<AuthenticatedUser> {
    return this.verifyToken(token);
  }

  /**
   * Cryptographically verifies a Supabase JWT and returns the AuthenticatedUser
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Authentication token missing or invalid');
    }

    // Inspect unprotected header to detect algorithm
    let header: jose.ProtectedHeaderParameters;
    try {
      header = jose.decodeProtectedHeader(token);
    } catch {
      throw new UnauthorizedException('Malformed token header');
    }

    // Check for explicit "none" algorithm rejection
    if (header.alg === 'none' || !header.alg) {
      throw new UnauthorizedException('Unsigned tokens with alg "none" are strictly forbidden');
    }

    // Inspect unprotected payload to check if issuer claim is present
    let unverifiedClaims: jose.JWTPayload | null = null;
    try {
      unverifiedClaims = jose.decodeJwt(token);
    } catch {
      // Ignored
    }

    const verificationOptions: jose.JWTVerifyOptions = {
      audience: this.expectedAudience,
      clockTolerance: this.clockTolerance,
    };

    if (this.expectedIssuer && unverifiedClaims?.iss) {
      verificationOptions.issuer = this.expectedIssuer;
    }

    // 1. Preferred path: Remote JWKS (Asymmetric algorithms only)
    if (this.jwks && ALLOWED_ASYMMETRIC_ALGORITHMS.includes(header.alg)) {
      try {
        const { payload } = await jose.jwtVerify(token, this.jwks, {
          ...verificationOptions,
          algorithms: ALLOWED_ASYMMETRIC_ALGORITHMS,
        });
        return this.mapPayloadToUser(payload);
      } catch (err: any) {
        // If symmetric secret is also configured and this was not an asymmetric key failure, do not mask real expiration/claims errors
        if (err.code === 'ERR_JWT_EXPIRED') {
          throw new UnauthorizedException('Token has expired');
        }
        if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          throw new UnauthorizedException(`Token claim validation failed: ${err.message}`);
        }
        throw new UnauthorizedException(`JWKS token verification failed: ${err.message}`);
      }
    }

    // 2. Reject HS256 tokens presenting to a JWKS-only configuration
    if (header.alg === 'HS256' && !this.jwtSecret) {
      throw new UnauthorizedException('Symmetric HS256 tokens are not accepted on the JWKS verification path');
    }

    // 3. Opt-in fallback path: Configured HS256 symmetric secret
    if (this.jwtSecret && header.alg === 'HS256') {
      try {
        const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
          ...verificationOptions,
          algorithms: ['HS256'],
        });
        return this.mapPayloadToUser(payload);
      } catch (err: any) {
        if (err.code === 'ERR_JWT_EXPIRED') {
          throw new UnauthorizedException('Token has expired');
        }
        if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
          throw new UnauthorizedException(`Token claim validation failed: ${err.message}`);
        }
        throw new UnauthorizedException(`Symmetric token verification failed: ${err.message}`);
      }
    }

    throw new UnauthorizedException(
      `Unsupported or disallowed token signing algorithm: "${header.alg}". Expected one of: ${ALLOWED_ASYMMETRIC_ALGORITHMS.join(', ')}`,
    );
  }

  private mapPayloadToUser(payload: jose.JWTPayload): AuthenticatedUser {
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') {
      throw new UnauthorizedException('Token payload missing "sub" claim');
    }

    // Strictly validate that sub is a UUID
    if (!UUID_REGEX.test(sub)) {
      throw new UnauthorizedException('Token "sub" claim must be a valid UUID');
    }

    const email = (payload['email'] as string) || (payload['user_metadata'] as any)?.email;
    if (!email || typeof email !== 'string') {
      throw new UnauthorizedException('Token payload missing valid email claim');
    }

    // Platform roles come ONLY from app_metadata.roles
    // Never use user_metadata or top-level "role" (it is the Postgres role "authenticated")
    const appMetadata = payload['app_metadata'] as Record<string, unknown> | undefined;
    let roles: string[] = [];

    if (appMetadata && Array.isArray(appMetadata['roles'])) {
      roles = appMetadata['roles'].filter((r): r is string => typeof r === 'string');
    }

    const sessionId = (payload['session_id'] as string) || undefined;

    return {
      id: sub,
      email,
      roles,
      sessionId,
    };
  }
}
