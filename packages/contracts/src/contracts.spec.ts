import { describe, it, expect } from 'vitest';
import { PRODUCT_NAME } from './constants.js';
import { UserSchema } from './dtos/user.dto.js';
import { HealthResponseSchema } from './dtos/health.dto.js';

describe('Contracts', () => {
  it('has Handrail as PRODUCT_NAME', () => {
    expect(PRODUCT_NAME).toBe('Handrail');
  });

  it('validates UserSchema correctly', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'learner@example.com',
      role: 'authenticated',
    };
    const parsed = UserSchema.parse(valid);
    expect(parsed.email).toBe('learner@example.com');
  });

  it('validates HealthResponseSchema', () => {
    const valid = {
      status: 'ok',
      service: 'test-service',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: 42,
    };
    const parsed = HealthResponseSchema.parse(valid);
    expect(parsed.status).toBe('ok');
  });
});

