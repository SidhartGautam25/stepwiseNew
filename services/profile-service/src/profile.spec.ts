import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileService } from './profile/profile.service.js';
import { EnrollmentService } from './enrollment/enrollment.service.js';
import { QUEUE_AUTH_EVENTS, TOPIC_EXCHANGE, ROUTING_KEY_USER_REGISTERED } from './events/auth-event-consumer.service.js';
import { SupabaseJwtVerifier, JwtAuthGuard } from '@app/auth';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jose from 'jose';

describe('ProfileService Core & JIT Provisioning', () => {
  let profileService: ProfileService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      recordActivity: vi.fn(),
      getActivities: vi.fn(),
    };

    profileService = new ProfileService(mockRepository);
  });

  it('returns existing user profile when found', async () => {
    const existingProfile = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'learner@handrail.dev',
      displayName: 'Senior Learner',
      defaultLevel: 'expert',
      defaultLanguage: 'rust',
      theme: 'dark',
    };
    mockRepository.findById.mockResolvedValue(existingProfile);

    const result = await profileService.getProfile('550e8400-e29b-41d4-a716-446655440000');

    expect(result).toEqual(existingProfile);
    expect(mockRepository.upsert).not.toHaveBeenCalled();
  });

  it('executes JIT (Just-In-Time) lazy profile provisioning when profile does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);
    mockRepository.upsert.mockResolvedValue({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'newbie@handrail.dev',
      displayName: 'newbie',
      defaultLevel: 'beginner',
      defaultLanguage: 'typescript',
      theme: 'dark',
    });
    mockRepository.recordActivity.mockResolvedValue({});

    const result = await profileService.getProfile(
      '550e8400-e29b-41d4-a716-446655440000',
      'newbie@handrail.dev',
    );

    expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.displayName).toBe('newbie');
    expect(mockRepository.upsert).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        email: 'newbie@handrail.dev',
        defaultLevel: 'beginner',
        defaultLanguage: 'typescript',
      }),
    );
    expect(mockRepository.recordActivity).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'JIT_PROFILE_INITIALIZED',
      expect.any(Object),
    );
  });

  it('handles auth.user.registered event idempotently', async () => {
    mockRepository.upsert.mockResolvedValue({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'event.user@handrail.dev',
    });
    mockRepository.recordActivity.mockResolvedValue({});

    const eventPayload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'event.user@handrail.dev',
      displayName: 'EventUser',
      provider: 'github',
    };

    // First delivery
    await profileService.handleUserRegisteredEvent(eventPayload);
    // Duplicate delivery (at-least-once guarantee)
    await profileService.handleUserRegisteredEvent(eventPayload);

    expect(mockRepository.upsert).toHaveBeenCalledTimes(2);
    expect(mockRepository.recordActivity).toHaveBeenCalledTimes(2);
  });

  it('updates profile and preferences', async () => {
    mockRepository.update.mockResolvedValue({
      userId: '123',
      displayName: 'Updated Name',
      theme: 'light',
    });

    await profileService.updateProfile('123', { displayName: 'Updated Name' });
    expect(mockRepository.update).toHaveBeenCalledWith('123', { displayName: 'Updated Name' });

    await profileService.updatePreferences('123', { theme: 'light' });
    expect(mockRepository.update).toHaveBeenCalledWith('123', { theme: 'light' });
  });
});

describe('Enrollment & Progress Domain', () => {
  let enrollmentService: EnrollmentService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findEnrollment: vi.fn(),
      findUserEnrollments: vi.fn(),
      createEnrollment: vi.fn(),
    };

    enrollmentService = new EnrollmentService(mockRepository);
  });

  it('enrolls user with first step AVAILABLE and remaining steps LOCKED', async () => {
    mockRepository.findEnrollment.mockResolvedValue(null);
    mockRepository.createEnrollment.mockImplementation((data: any) => Promise.resolve(data));

    const enrollment = await enrollmentService.enroll(
      'user-123',
      'build-your-own-react',
      'typescript',
    );

    expect(enrollment.workshopSlug).toBe('build-your-own-react');
    expect(enrollment.steps[0].stepSlug).toBe('step-1');
    expect(enrollment.steps[0].status).toBe('AVAILABLE');
    expect(enrollment.steps[1].status).toBe('LOCKED');
    expect(enrollment.steps[2].status).toBe('LOCKED');
  });

  it('returns existing enrollment if user is already enrolled', async () => {
    const existing = { id: 'enr-1', workshopSlug: 'build-your-own-git', language: 'go' };
    mockRepository.findEnrollment.mockResolvedValue(existing);

    const res = await enrollmentService.enroll('user-123', 'build-your-own-git', 'go');
    expect(res).toBe(existing);
    expect(mockRepository.createEnrollment).not.toHaveBeenCalled();
  });
});

describe('Defense-In-Depth Local Token Verification in profile-service', () => {
  const secret = 'configured-jwt-secret-for-profile-service-verification-min-32-chars!';
  let verifier: SupabaseJwtVerifier;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    verifier = new SupabaseJwtVerifier({
      supabaseJwtSecret: secret,
      audience: 'authenticated',
    });

    const reflector = new Reflector();
    guard = new JwtAuthGuard(reflector, verifier);
  });

  function createMockContext(headers: Record<string, string>): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          cookies: {},
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('rejects forged x-user-id headers without valid Bearer token', async () => {
    const context = createMockContext({
      'x-user-id': 'forged-attacker-id',
      'x-user-email': 'attacker@evil.com',
      // No Authorization Bearer token provided
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates valid local JWT token and populates user principal', async () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const token = await new jose.SignJWT({
      email: 'learner@handrail.dev',
      app_metadata: { roles: ['learner'] },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(validUuid)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cookies: {},
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
    expect(req.user.id).toBe(validUuid);
    expect(req.user.email).toBe('learner@handrail.dev');
  });
});

describe('RabbitMQ Topology Constants for profile-service', () => {
  it('binds to durable queue and topic exchange', () => {
    expect(QUEUE_AUTH_EVENTS).toBe('profile-service.auth-events');
    expect(TOPIC_EXCHANGE).toBe('platform.events');
    expect(ROUTING_KEY_USER_REGISTERED).toBe('auth.user.registered');
  });
});
