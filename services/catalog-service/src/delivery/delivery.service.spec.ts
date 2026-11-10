import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service.js';
import { InMemoryAccessPolicyFake } from '../access/in-memory-access-policy.fake.js';

describe('DeliveryService (Gated Starters)', () => {
  let deliveryService: DeliveryService;
  let mockPrisma: any;
  let mockStorage: any;
  let accessPolicyFake: InMemoryAccessPolicyFake;

  beforeEach(() => {
    accessPolicyFake = new InMemoryAccessPolicyFake();
    mockPrisma = {
      workshop: {
        findUnique: vi.fn(),
      },
      artifact: {
        findFirst: vi.fn(),
      },
    };
    mockStorage = {
      getSignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/signed-starter-url?sig=abc'),
    };

    deliveryService = new DeliveryService(
      mockPrisma,
      mockStorage,
      accessPolicyFake as any,
    );
  });

  const mockUser: any = { id: 'learner-1', roles: ['learner'] };

  it('blocks unenrolled learner from downloading starter (403)', async () => {
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
      deliveryService.getStarterDownloadUrl('build-http-server', 'go', mockUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects missing language parameter (400)', async () => {
    await expect(
      deliveryService.getStarterDownloadUrl('build-http-server', undefined, mockUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('FAILS CLOSED: throws 503 when access check cannot be verified', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    accessPolicyFake.setOutage(true);

    await expect(
      deliveryService.getStarterDownloadUrl('build-http-server', 'go', mockUser),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('returns short-lived signed S3 download URL for enrolled learner', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    mockPrisma.artifact.findFirst.mockResolvedValue({
      id: 'art-starter-go',
      storageKey: 'workshops/build-http-server/1.0.0/starters/go.zip',
    });

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
    });

    const res = await deliveryService.getStarterDownloadUrl('build-http-server', 'go', mockUser);

    expect(res.url).toBe('https://minio.local/signed-starter-url?sig=abc');
    expect(res.language).toBe('go');
    expect(res.filename).toBe('build-http-server-go-starter.zip');
    expect(res.version).toBe('1.0.0');
    expect(mockStorage.getSignedDownloadUrl).toHaveBeenCalledWith(
      'workshops/build-http-server/1.0.0/starters/go.zip',
      300,
      'build-http-server-go-starter.zip',
    );
  });

  it('throws 404 if starter zip is not present for requested language', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'ver-100',
      versions: [{ id: 'ver-100', version: '1.0.0' }],
    });

    mockPrisma.artifact.findFirst.mockResolvedValue(null);

    accessPolicyFake.setAccess('learner-1', 'build-http-server', {
      enrolled: true,
      versionId: 'ver-100',
      unlockedChapters: ['01-ping'],
    });

    await expect(
      deliveryService.getStarterDownloadUrl('build-http-server', 'rust', mockUser),
    ).rejects.toThrow(NotFoundException);
  });
});
