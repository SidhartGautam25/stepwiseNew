import { describe, it, expect, beforeEach } from 'vitest';
import { EnrollmentService } from './enrollment.service.js';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let enrollmentsDb: Map<string, any>;
  let stepProgressDb: Map<string, any>;

  beforeEach(() => {
    enrollmentsDb = new Map();
    stepProgressDb = new Map();

    const mockPrisma = {
      enrollment: {
        findUnique: async ({ where }: any) => {
          const key = `${where.userId_workshopSlug_language.userId}:${where.userId_workshopSlug_language.workshopSlug}:${where.userId_workshopSlug_language.language}`;
          return enrollmentsDb.get(key) || null;
        },
        create: async ({ data }: any) => {
          const rec = { id: `enroll-${Date.now()}`, ...data, enrolledAt: new Date() };
          const key = `${data.userId}:${data.workshopSlug}:${data.language}`;
          enrollmentsDb.set(key, rec);
          return rec;
        },
        findFirst: async ({ where }: any) => {
          for (const val of enrollmentsDb.values()) {
            if (val.userId === where.userId && val.workshopSlug === where.workshopSlug) {
              const steps: any[] = [];
              for (const sp of stepProgressDb.values()) {
                if (sp.enrollmentId === val.id) {
                  steps.push(sp);
                }
              }
              return { ...val, steps };
            }
          }
          return null;
        },
      },
      stepProgress: {
        findUnique: async ({ where }: any) => {
          const key = `${where.enrollmentId_stepSlug.enrollmentId}:${where.enrollmentId_stepSlug.stepSlug}`;
          return stepProgressDb.get(key) || null;
        },
        create: async ({ data }: any) => {
          const rec = { id: `sp-${Date.now()}-${Math.random()}`, ...data, completedAt: null };
          const key = `${data.enrollmentId}:${data.stepSlug}`;
          stepProgressDb.set(key, rec);
          return rec;
        },
      },
    } as any;

    service = new EnrollmentService(mockPrisma);
  });

  it('discovers workshop steps from content for all workshops', async () => {
    const redisSteps = await service.getWorkshopSteps('build-your-own-redis');
    expect(redisSteps).toHaveLength(4);
    expect(redisSteps[0].globalOrder).toBe(1);
    expect(redisSteps[0].slug).toBe('01-bind-port');

    const reactSteps = await service.getWorkshopSteps('build-your-own-react');
    expect(reactSteps).toHaveLength(4);
    expect(reactSteps[0].globalOrder).toBe(1);
    expect(reactSteps[0].slug).toBe('01-create-element');

    const gitSteps = await service.getWorkshopSteps('build-your-own-git');
    expect(gitSteps).toHaveLength(4);
    expect(gitSteps[0].globalOrder).toBe(1);
    expect(gitSteps[0].slug).toBe('01-git-init');

    const npmSteps = await service.getWorkshopSteps('build-your-own-npm');
    expect(npmSteps).toHaveLength(4);
    expect(npmSteps[0].globalOrder).toBe(1);
    expect(npmSteps[0].slug).toBe('01-fetch-manifest');
  });

  it('enrolls a user with first step AVAILABLE and remaining steps LOCKED', async () => {
    const result = await service.enroll('build-your-own-redis', 'go', 'user-123');

    expect(result.workshopSlug).toBe('build-your-own-redis');
    expect(result.language).toBe('go');
    expect(result.firstStep.globalOrder).toBe(1);
    expect(result.firstStep.slug).toBe('01-bind-port');

    expect(result.steps).toHaveLength(4);
    // First step is AVAILABLE
    expect(result.steps[0].status).toBe('AVAILABLE');
    expect(result.steps[0].stepSlug).toBe('01-bind-port');

    // Remaining steps are LOCKED
    expect(result.steps[1].status).toBe('LOCKED');
    expect(result.steps[2].status).toBe('LOCKED');
    expect(result.steps[3].status).toBe('LOCKED');
  });

  it('allows fetching user progress state accurately', async () => {
    await service.enroll('build-your-own-react', 'typescript', 'user-456');
    const progress = await service.getWorkshopProgress('build-your-own-react', 'user-456');

    expect(progress.isEnrolled).toBe(true);
    expect(progress.language).toBe('typescript');
    expect(progress.steps).toHaveLength(4);
    expect(progress.steps[0].status).toBe('AVAILABLE');
    expect(progress.steps[1].status).toBe('LOCKED');
  });
});

