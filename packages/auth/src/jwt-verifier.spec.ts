import { describe, it, expect, beforeEach } from 'vitest';
import * as jose from 'jose';
import { JwtVerifierService } from './jwt-verifier.service.js';

describe('JwtVerifierService', () => {
  const secret = 'super-secret-test-jwt-key-minimum-32-chars-long!';
  let verifier: JwtVerifierService;

  beforeEach(() => {
    verifier = new JwtVerifierService();
    verifier.init({ supabaseJwtSecret: secret });
  });

  it('successfully verifies a valid HS256 token', async () => {
    const rawSecret = new TextEncoder().encode(secret);
    const token = await new jose.SignJWT({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'engineer@example.com',
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rawSecret);

    const user = await verifier.verifyToken(token);
    expect(user.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(user.email).toBe('engineer@example.com');
  });

  it('rejects an expired token', async () => {
    const rawSecret = new TextEncoder().encode(secret);
    const expiredToken = await new jose.SignJWT({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'engineer@example.com',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(rawSecret);

    await expect(verifier.verifyToken(expiredToken)).rejects.toThrow();
  });

  it('rejects an invalid signature', async () => {
    const wrongSecret = new TextEncoder().encode('another-different-key-that-does-not-match!');
    const token = await new jose.SignJWT({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      email: 'engineer@example.com',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .sign(wrongSecret);

    await expect(verifier.verifyToken(token)).rejects.toThrow();
  });
});
