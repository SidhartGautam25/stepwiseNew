import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';
import type { UserDto } from '@app/contracts';

export interface JwtVerifierOptions {
  supabaseUrl?: string;
  supabaseJwtSecret?: string;
  jwksUri?: string;
}

@Injectable()
export class JwtVerifierService {
  private readonly logger = new Logger(JwtVerifierService.name);
  private jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
  private jwtSecret: Uint8Array | null = null;
  private jwksUri: string | null = null;

  constructor() {
    this.init();
  }

  public init(options?: JwtVerifierOptions) {
    const supabaseUrl = options?.supabaseUrl || process.env.SUPABASE_URL;
    const secret = options?.supabaseJwtSecret || process.env.SUPABASE_JWT_SECRET;
    const customJwksUri = options?.jwksUri || process.env.SUPABASE_JWKS_URI;

    if (customJwksUri) {
      this.jwksUri = customJwksUri;
      this.jwks = jose.createRemoteJWKSet(new URL(this.jwksUri));
      this.logger.log(`Initialized JWKS verifier with URL: ${this.jwksUri}`);
    } else if (supabaseUrl) {
      this.jwksUri = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`;
      this.jwks = jose.createRemoteJWKSet(new URL(this.jwksUri));
      this.logger.log(`Initialized JWKS verifier with Supabase URL: ${this.jwksUri}`);
    }

    if (secret) {
      this.jwtSecret = new TextEncoder().encode(secret);
      this.logger.log('Configured HS256 JWT secret fallback');
    }
  }

  async verifyToken(token: string): Promise<UserDto> {
    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    // 1. Try JWKS asymmetric verification first (RS256 / ES256)
    if (this.jwks) {
      try {
        const { payload } = await jose.jwtVerify(token, this.jwks);
        return this.mapPayloadToUser(payload);
      } catch (err: any) {
        // If error is not secret-fallback eligible or secret is not configured, rethrow
        if (!this.jwtSecret) {
          this.logger.warn(`JWKS token verification failed: ${err.message}`);
          throw new UnauthorizedException(`Invalid token: ${err.message}`);
        }
        this.logger.debug(`JWKS verification unsuccessful (${err.message}), falling back to HS256 secret`);
      }
    }

    // 2. Fallback to HS256 symmetric verification
    if (this.jwtSecret) {
      try {
        const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
          algorithms: ['HS256'],
        });
        return this.mapPayloadToUser(payload);
      } catch (err: any) {
        this.logger.warn(`HS256 fallback verification failed: ${err.message}`);
        throw new UnauthorizedException(`Invalid token: ${err.message}`);
      }
    }

    throw new UnauthorizedException('No JWT verification mechanism configured (missing JWKS URI and secret)');
  }

  private mapPayloadToUser(payload: jose.JWTPayload): UserDto {
    const sub = payload.sub;
    if (!sub) {
      throw new UnauthorizedException('Token payload missing "sub" claim');
    }

    const email = (payload['email'] as string) || (payload['user_metadata'] as any)?.email;
    if (!email) {
      throw new UnauthorizedException('Token payload missing email claim');
    }

    return {
      id: sub,
      email,
      role: (payload['role'] as string) || 'authenticated',
      appMetadata: payload['app_metadata'] as Record<string, unknown> | undefined,
      userMetadata: payload['user_metadata'] as Record<string, unknown> | undefined,
    };
  }
}
