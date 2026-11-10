import { describe, it, expect } from 'vitest';
import { PRODUCT_NAME } from './constants.js';
import { UserSchema } from './dtos/user.dto.js';
import { HealthResponseSchema } from './dtos/health.dto.js';
import {
  WorkshopResolveSchema,
  VersionStructureSchema,
  TestBundleRefSchema,
  AccessCheckSchema,
  StarterDownloadUrlSchema,
} from './dtos/catalog.dto.js';

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

  it('validates Milestone C3 Cross-Service Contracts', () => {
    // 1. WorkshopResolve
    const resolve = WorkshopResolveSchema.parse({
      id: 'ws-1',
      slug: 'http-server',
      title: 'Build HTTP Server',
      latestPublishedVersionId: 'ver-100',
      latestVersion: '1.0.0',
      status: 'active',
    });
    expect(resolve.slug).toBe('http-server');

    // 2. VersionStructure
    const structure = VersionStructureSchema.parse({
      versionId: 'ver-100',
      workshopSlug: 'http-server',
      version: '1.0.0',
      chapters: [
        {
          chapterId: 'ch-1',
          chapterKey: '01-ping',
          orderNo: 1,
          title: 'Ping',
          estMinutes: 20,
          steps: [
            {
              stepId: 'st-1',
              stepKey: 'bind-socket',
              orderInChapter: 1,
              title: 'Bind Socket',
            },
          ],
        },
      ],
    });
    expect(structure.chapters[0].chapterKey).toBe('01-ping');

    // 3. TestBundleRef
    const testBundle = TestBundleRefSchema.parse({
      url: 'https://s3.example.com/test.tar.gz',
      sha256: 'abc123sha',
      size: 1024,
      expiresAt: new Date().toISOString(),
      chapterKey: '01-ping',
      steps: [
        {
          stepKey: 'bind-socket',
          tests: [{ id: 't1', hidden: false }],
        },
      ],
    });
    expect(testBundle.chapterKey).toBe('01-ping');

    // 4. AccessCheck
    const access = AccessCheckSchema.parse({
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
      currentChapterId: '01-ping',
    });
    expect(access.enrolled).toBe(true);

    // 5. StarterDownloadUrl
    const starterUrl = StarterDownloadUrlSchema.parse({
      url: 'https://s3.example.com/starter.zip',
      filename: 'starter.zip',
      language: 'go',
      version: '1.0.0',
      expiresAt: new Date().toISOString(),
    });
    expect(starterUrl.language).toBe('go');
  });
});


