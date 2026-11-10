import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockAudit: any;
  let mockEvents: any;
  let mockQueue: any;

  beforeEach(() => {
    mockPrisma = {
      workshop: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workshopVersion: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      artifact: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditEvent: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };
    mockStorage = {
      copyObject: vi.fn().mockResolvedValue(undefined),
    };
    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    mockEvents = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    mockQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    service = new AdminService(
      mockPrisma,
      mockStorage,
      mockAudit,
      mockEvents,
      mockQueue,
    );
  });

  it('throws ConflictException if workshop slug already registered', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({ id: 'w1', slug: 'existing' });

    await expect(
      service.registerWorkshop({ slug: 'existing', repoFullName: 'org/repo' }),
    ).rejects.toThrow(ConflictException);
  });

  it('registers workshop and enqueues initial sync', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue(null);
    mockPrisma.workshop.create.mockResolvedValue({
      id: 'w1',
      slug: 'new-ws',
      repoFullName: 'org/repo',
    });

    const res = await service.registerWorkshop({
      slug: 'new-ws',
      repoFullName: 'org/repo',
    });

    expect(res.slug).toBe('new-ws');
    expect(mockQueue.enqueue).toHaveBeenCalledWith({
      workshopSlug: 'new-ws',
      trigger: 'manual',
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      'admin',
      'workshop.register',
      'new-ws',
      expect.any(Object),
    );
  });

  it('rejects publishing with invalid semver', async () => {
    await expect(
      service.publishVersion('test-ws', 'v-draft', { version: 'not-a-semver' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects publishing when draft has lint errors', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'test-ws',
      versions: [
        {
          id: 'v-draft',
          version: 'draft',
          kind: 'draft',
          lintReportJson: { summary: { errors: 2 } },
        },
      ],
    });

    await expect(
      service.publishVersion('test-ws', 'v-draft', { version: '1.0.0' }),
    ).rejects.toThrow('Cannot publish draft with 2 lint error(s)');
  });

  it('enforces SemVer monotonicity against existing published versions', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'test-ws',
      versions: [
        { id: 'v-draft', version: 'draft', kind: 'draft', lintReportJson: { summary: { errors: 0 } } },
        { id: 'v-100', version: '1.0.0', kind: 'published' },
        { id: 'v-110', version: '1.1.0', kind: 'published' },
      ],
    });

    // Attempting to publish 1.0.5 when 1.1.0 is already published
    await expect(
      service.publishVersion('test-ws', 'v-draft', { version: '1.0.5' }),
    ).rejects.toThrow('New version "1.0.5" must be strictly greater than latest published version "1.1.0"');
  });

  it('successfully publishes draft to 1.2.0, copies S3 artifacts, updates database, and emits event', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'test-ws',
      versions: [
        { id: 'v-draft', version: 'draft', kind: 'draft', lintReportJson: { summary: { errors: 0 } } },
        { id: 'v-110', version: '1.1.0', kind: 'published' },
      ],
    });
    mockPrisma.artifact.findMany.mockResolvedValue([
      { id: 'art-1', storageKey: 'workshops/test-ws/draft/starters/go.zip' },
      { id: 'art-2', storageKey: 'workshops/test-ws/draft/chapters/01-ping/tests.tar.gz' },
    ]);

    const result = await service.publishVersion('test-ws', 'v-draft', { version: '1.2.0' });

    expect(result.version).toBe('1.2.0');
    expect(result.status).toBe('published');
    expect(mockStorage.copyObject).toHaveBeenCalledWith(
      'workshops/test-ws/draft/starters/go.zip',
      'workshops/test-ws/1.2.0/starters/go.zip',
    );
    expect(mockEvents.publish).toHaveBeenCalledWith(
      'catalog.workshop.published',
      expect.objectContaining({
        workshopSlug: 'test-ws',
        version: '1.2.0',
      }),
    );
    expect(mockAudit.log).toHaveBeenCalledWith(
      'admin',
      'workshop.publish',
      'test-ws',
      expect.any(Object),
    );
  });

  it('deprecateVersion marks version as deprecated and recalculates latestPublishedId if necessary', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'w1',
      slug: 'test-ws',
      latestPublishedId: 'v-200',
      versions: [
        { id: 'v-100', version: '1.0.0', kind: 'published' },
        { id: 'v-200', version: '2.0.0', kind: 'published' },
      ],
    });

    const result = await service.deprecateVersion('test-ws', {
      version: '2.0.0',
      reason: 'Superseded by 3.0.0 architecture',
    });

    expect(result.status).toBe('deprecated');
    expect(mockPrisma.workshopVersion.update).toHaveBeenCalledWith({
      where: { id: 'v-200' },
      data: { kind: 'deprecated' },
    });
    // Verifies latestPublishedId fell back to the next highest published version (1.0.0)
    expect(mockPrisma.workshop.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { latestPublishedId: 'v-100' },
    });
    expect(mockAudit.log).toHaveBeenCalledWith(
      'admin',
      'workshop.deprecate',
      'test-ws',
      expect.objectContaining({ version: '2.0.0', reason: 'Superseded by 3.0.0 architecture' }),
    );
  });

  it('listAuditEvents retrieves filtered and paginated audit records', async () => {
    mockPrisma.auditEvent.count.mockResolvedValue(15);
    mockPrisma.auditEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        actor: 'admin',
        action: 'workshop.publish',
        subject: 'test-ws',
        createdAt: new Date(),
      },
    ]);

    const res = await service.listAuditEvents({
      subject: 'test-ws',
      action: 'workshop.publish',
      limit: 10,
      offset: 0,
    });

    expect(res.total).toBe(15);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].action).toBe('workshop.publish');
  });
});
