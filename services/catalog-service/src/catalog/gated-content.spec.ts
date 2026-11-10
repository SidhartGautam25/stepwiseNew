import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { InMemoryAccessPolicyFake } from '../access/in-memory-access-policy.fake.js';

describe('Gated Content Endpoints (Chapters & Steps)', () => {
  let catalogService: CatalogService;
  let mockPrisma: any;
  let accessPolicyFake: InMemoryAccessPolicyFake;

  beforeEach(() => {
    accessPolicyFake = new InMemoryAccessPolicyFake();
    mockPrisma = {
      workshop: {
        findUnique: vi.fn(),
      },
      chapter: {
        findFirst: vi.fn(),
      },
      step: {
        findFirst: vi.fn(),
      },
    };

    catalogService = new CatalogService(mockPrisma, accessPolicyFake as any);
  });

  const mockUser: any = { id: 'learner-1', roles: ['learner'] };

  it('blocks unenrolled learner from accessing chapters (403)', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: false,
      unlockedChapters: [],
    });

    await expect(
      catalogService.getGatedChapter('build-http-server', '01-ping', 'beginner', mockUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks enrolled learner from accessing locked chapter (403)', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    mockPrisma.chapter.findFirst.mockResolvedValue({
      id: 'ch-2',
      chapterKey: '02-pong',
      orderNo: 2,
      title: 'Pong',
      summary: 'Pong chapter',
      intros: [],
      steps: [],
    });

    // Learner only has chapter 1 unlocked
    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
    });

    await expect(
      catalogService.getGatedChapter('build-http-server', '02-pong', 'beginner', mockUser),
    ).rejects.toThrow('Chapter "02-pong" is locked');
  });

  it('serves chapter intro and steps when unlocked', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    mockPrisma.chapter.findFirst.mockResolvedValue({
      id: 'ch-1',
      chapterKey: '01-ping',
      orderNo: 1,
      title: 'Ping',
      summary: 'Ping chapter',
      intros: [{ level: 'beginner', md: '# Welcome to Ping' }],
      steps: [
        { id: 'st-1', stepKey: 'bind-socket', title: 'Bind Socket', orderInChapter: 1 },
      ],
    });

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
    });

    const result = await catalogService.getGatedChapter(
      'build-http-server',
      '01-ping',
      'beginner',
      mockUser,
    );

    expect(result.chapterKey).toBe('01-ping');
    expect(result.introMd).toBe('# Welcome to Ping');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stepKey).toBe('bind-socket');
  });

  it('FAILS CLOSED: throws 503 when access check fails, never leaking content', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    accessPolicyFake.setOutage(true);

    await expect(
      catalogService.getGatedChapter('build-http-server', '01-ping', 'beginner', mockUser),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('serves step task, theory, and hints for requested level', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    mockPrisma.chapter.findFirst.mockResolvedValue({
      id: 'ch-1',
      chapterKey: '01-ping',
    });

    mockPrisma.step.findFirst.mockResolvedValue({
      id: 'st-1',
      stepKey: 'bind-socket',
      title: 'Bind Socket',
      orderInChapter: 1,
      contents: [
        { kind: 'task', level: 'beginner', md: 'Task details' },
        { kind: 'theory', level: 'beginner', md: 'Theory details' },
        { kind: 'hint', level: 'beginner', md: 'Hint details' },
      ],
    });

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
    });

    const step = await catalogService.getGatedStep(
      'build-http-server',
      '01-ping',
      'bind-socket',
      'beginner',
      mockUser,
    );

    expect(step.stepKey).toBe('bind-socket');
    expect(step.taskMd).toBe('Task details');
    expect(step.theoryMd).toBe('Theory details');
    expect(step.hintsMd).toBe('Hint details');
  });

  it('allows enrolled learner pinned to a deprecated version to access their content', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-200', // Latest published is 2.0.0
      versions: [
        { id: 'ver-100', version: '1.0.0', kind: 'deprecated' }, // Learner pinned to deprecated 1.0.0
        { id: 'ver-200', version: '2.0.0', kind: 'published' },
      ],
    });

    mockPrisma.chapter.findFirst.mockResolvedValue({
      id: 'ch-1',
      chapterKey: '01-ping',
      orderNo: 1,
      title: 'Ping (v1.0.0 deprecated)',
      summary: 'Legacy ping chapter',
      intros: [{ level: 'beginner', md: '# Legacy Intro' }],
      steps: [],
    });

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100', // Pinned to deprecated version
      unlockedChapters: ['01-ping'],
    });

    const result = await catalogService.getGatedChapter(
      'build-http-server',
      '01-ping',
      'beginner',
      mockUser,
    );

    expect(result.version).toBe('1.0.0');
    expect(result.introMd).toBe('# Legacy Intro');
  });
});
