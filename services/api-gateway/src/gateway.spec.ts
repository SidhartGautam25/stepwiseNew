import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as jose from 'jose';
import request from 'supertest';
import { AppModule } from './app.module.js';

describe('API Gateway Integration Tests', () => {
  let app: INestApplication;
  const testSecret = 'super-secret-jwt-token-with-minimum-32-chars-long!';

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = testSecret;
    process.env.SERVICE_NAME = 'api-gateway';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /health returns 200 with service status', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('api-gateway');
  });

  it('GET /v1/me returns 401 when no token is provided', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me');
    expect(res.status).toBe(401);
  });

  it('GET /v1/me rejects forged x-user-id headers without Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('x-user-id', 'spoofed-id')
      .set('x-user-email', 'spoofed@evil.com');
    // At perimeter gateway, client cannot forge headers
    expect(res.status).toBe(401);
  });

  it('GET /v1/me returns authenticated user when valid JWT Bearer token is provided', async () => {
    const rawSecret = new TextEncoder().encode(testSecret);
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const email = 'verified.learner@handrail.dev';

    const token = await new jose.SignJWT({
      sub: userId,
      email,
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(rawSecret);

    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
    expect(res.body.email).toBe(email);
  });
});
