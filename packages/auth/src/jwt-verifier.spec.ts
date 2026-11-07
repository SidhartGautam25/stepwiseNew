import { describe, it, expect, beforeAll } from 'vitest';
import * as jose from 'jose';
import { SupabaseJwtVerifier } from './supabase-jwt-verifier.service.js';

describe('SupabaseJwtVerifier', () => {
  const mockIssuer = 'https://auth.handrail.dev/auth/v1';
  let rsaKeyPair: jose.GenerateKeyPairResult;
  let rsaPublicJwk: jose.JWK;
  let localJwks: jose.JSONWebKeySet;

  beforeAll(async () => {
    // Generate RSA key pair for testing asymmetric signatures
    rsaKeyPair = await jose.generateKeyPair('RS256');
    rsaPublicJwk = await jose.exportJWK(rsaKeyPair.publicKey);
    rsaPublicJwk.kid = 'test-key-1';
    rsaPublicJwk.alg = 'RS256';
    rsaPublicJwk.use = 'sig';
    localJwks = { keys: [rsaPublicJwk] };
  });

  it('successfully verifies a valid RS256 token via JWKS and parses app_metadata.roles', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      issuer: mockIssuer,
      audience: 'authenticated',
    });

    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const token = await new jose.SignJWT({
      email: 'engineer@handrail.dev',
      role: 'authenticated', // Postgres role, NOT platform role
      app_metadata: {
        roles: ['admin', 'content_creator'],
      },
      user_metadata: {
        roles: ['superadmin'], // Must NOT be picked up
      },
      session_id: 'sess-12345',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject(validUuid)
      .setIssuer(mockIssuer)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rsaKeyPair.privateKey);

    const user = await verifier.verifyToken(token);

    expect(user.id).toBe(validUuid);
    expect(user.email).toBe('engineer@handrail.dev');
    expect(user.roles).toEqual(['admin', 'content_creator']);
    expect(user.sessionId).toBe('sess-12345');
    // Ensure user_metadata.roles was not leaked into user.roles
    expect(user.roles).not.toContain('superadmin');
  });

  it('rejects an expired RS256 token', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      issuer: mockIssuer,
      audience: 'authenticated',
    });

    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const expiredToken = await new jose.SignJWT({
      email: 'expired@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject(validUuid)
      .setIssuer(mockIssuer)
      .setAudience('authenticated')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(rsaKeyPair.privateKey);

    await expect(verifier.verifyToken(expiredToken)).rejects.toThrow('Token has expired');
  });

  it('rejects a token with invalid audience', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      issuer: mockIssuer,
      audience: 'authenticated',
    });

    const token = await new jose.SignJWT({
      email: 'engineer@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('550e8400-e29b-41d4-a716-446655440000')
      .setIssuer(mockIssuer)
      .setAudience('wrong-aud')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rsaKeyPair.privateKey);

    await expect(verifier.verifyToken(token)).rejects.toThrow();
  });

  it('rejects a token with invalid issuer', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      issuer: mockIssuer,
      audience: 'authenticated',
    });

    const token = await new jose.SignJWT({
      email: 'engineer@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('550e8400-e29b-41d4-a716-446655440000')
      .setIssuer('https://malicious.issuer.com/auth/v1')
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rsaKeyPair.privateKey);

    await expect(verifier.verifyToken(token)).rejects.toThrow();
  });

  it('strictly rejects algorithm "none"', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      audience: 'authenticated',
    });

    const rawHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const rawPayload = Buffer.from(
      JSON.stringify({
        sub: '550e8400-e29b-41d4-a716-446655440000',
        email: 'attacker@evil.com',
        aud: 'authenticated',
      }),
    ).toString('base64url');
    const noneToken = `${rawHeader}.${rawPayload}.`;

    await expect(verifier.verifyToken(noneToken)).rejects.toThrow('strictly forbidden');
  });

  it('rejects algorithm confusion: HS256 presented to a JWKS-only verifier', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      audience: 'authenticated',
      // No supabaseJwtSecret configured
    });

    const symmetricSecret = new TextEncoder().encode('my-symmetric-fake-key-for-testing-only!');
    const hs256Token = await new jose.SignJWT({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'confused@handrail.dev',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(symmetricSecret);

    await expect(verifier.verifyToken(hs256Token)).rejects.toThrow('JWKS verification path');
  });

  it('rejects non-UUID sub claims', async () => {
    const verifier = new SupabaseJwtVerifier({
      localJwks,
      issuer: mockIssuer,
      audience: 'authenticated',
    });

    const token = await new jose.SignJWT({
      email: 'bad-sub@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setSubject('not-a-valid-uuid-1234')
      .setIssuer(mockIssuer)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rsaKeyPair.privateKey);

    await expect(verifier.verifyToken(token)).rejects.toThrow('must be a valid UUID');
  });

  it('verifies HS256 token when explicit fallback secret is configured', async () => {
    const fallbackSecret = 'configured-jwt-secret-for-local-fallback-only-minimum-32-chars!';
    const verifier = new SupabaseJwtVerifier({
      supabaseJwtSecret: fallbackSecret,
      audience: 'authenticated',
    });

    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const hsToken = await new jose.SignJWT({
      email: 'fallback@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(validUuid)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(fallbackSecret));

    const user = await verifier.verifyToken(hsToken);
    expect(user.id).toBe(validUuid);
    expect(user.email).toBe('fallback@handrail.dev');
    expect(user.roles).toEqual(['learner']);
  });
});
