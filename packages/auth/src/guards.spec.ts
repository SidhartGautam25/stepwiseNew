import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './guards/roles.guard.js';
import { ServiceAuthGuard } from './guards/service-auth.guard.js';

function createMockExecutionContext(user: any): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access if no roles are required', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => undefined;
    const guard = new RolesGuard(reflector);

    const context = createMockExecutionContext({ id: 'u1', roles: [] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access if user has required role', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['admin'];
    const guard = new RolesGuard(reflector);

    const context = createMockExecutionContext({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'admin@handrail.dev',
      roles: ['admin', 'content_creator'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user lacks required role', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => ['admin'];
    const guard = new RolesGuard(reflector);

    const context = createMockExecutionContext({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'learner@handrail.dev',
      roles: ['learner'],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

describe('ServiceAuthGuard', () => {
  it('allows access if route has no service scope requirement', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => undefined;
    const guard = new ServiceAuthGuard(reflector);

    const context = createMockExecutionContext({});
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access if principal has service role and required scope', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => 'verification:write';
    const guard = new ServiceAuthGuard(reflector);

    const context = createMockExecutionContext({
      id: 'service-worker',
      email: 'service@internal',
      roles: ['service'],
      scopes: ['verification:write'],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access if principal lacks service scope', () => {
    const reflector = new Reflector();
    reflector.getAllAndOverride = () => 'verification:write';
    const guard = new ServiceAuthGuard(reflector);

    const context = createMockExecutionContext({
      id: 'service-worker',
      email: 'service@internal',
      roles: ['service'],
      scopes: ['other:read'],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
