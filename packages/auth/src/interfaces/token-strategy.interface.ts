import type { AuthenticatedUser } from '@app/contracts';
import type * as jose from 'jose';

export interface TokenStrategy {
  readonly name: string;
  canHandle(token: string): boolean;
  validate(token: string): Promise<AuthenticatedUser>;
}

export interface AuthModuleOptions {
  supabaseUrl?: string;
  supabaseJwtSecret?: string;
  jwksUri?: string;
  jwks?: ReturnType<typeof jose.createRemoteJWKSet> | ReturnType<typeof jose.createLocalJWKSet>;
  localJwks?: jose.JSONWebKeySet;
  issuer?: string;
  audience?: string;
  clockTolerance?: number; // In seconds (default: 30)
  cookieNames?: string[]; // e.g. ['__Secure-hr_at', 'hr_at']
  denylistChecker?: (userId: string, sessionId?: string, iat?: number) => Promise<boolean>;
}
