import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { InMemoryAccessPolicyFake } from '../access/in-memory-access-policy.fake.js';

describe('CatalogService', () => {
  let service: CatalogService;
  let mockPrisma: any;
  let accessPolicyFake: InMemoryAccessPolicyFake;

  beforeEach(() => {
    accessPolicyFake = new InMemoryAccessPolicyFake();
    mockPrisma = {
      workshop: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    service = new CatalogService(mockPrisma, accessPolicyFake as any);
  });

  it('listWorkshops returns only workshops with latestPublishedId', async () => {
    mockPrisma.workshop.findMany.mockResolvedValue([
      {
        id: 'ws-1',
        slug: 'build-http-server',
        latestPublishedId: 'v-100',
        versions: [
          {
            id: 'v-100',
            version: '1.0.0',
            overview: {
              sectionsJson: {
                whatWeBuild: 'Build an HTTP server',
                howItWorks: 'Step by step TCP and HTTP',
              },
            },
            chapters: [{ steps: [{ id: 's1' }, { id: 's2' }] }],
            artifacts: [{ language: 'go' }, { language: 'python' }],
          },
        ],
      },
    ]);

    const result = await service.listWorkshops();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('build-http-server');
    expect(result[0].version).toBe('1.0.0');
    expect(result[0].languages).toEqual(['go', 'python']);
    expect(result[0].totalSteps).toBe(2);
  });

  it('getWorkshopBySlug prevents non-admin from accessing draft version', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'v-100',
      versions: [],
    });

    const nonAdminUser: any = { id: 'u1', roles: ['learner'] };

    await expect(
      service.getWorkshopBySlug('build-http-server', 'draft', nonAdminUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('getWorkshopBySlug allows admin to access draft version', async () => {
    mockPrisma.workshop.findUnique.mockResolvedValue({
      id: 'ws-1',
      slug: 'build-http-server',
      latestPublishedId: 'v-100',
      versions: [
        {
          id: 'v-draft',
          version: 'draft',
          kind: 'draft',
          overview: { sectionsJson: { whatWeBuild: 'Draft server' } },
          chapters: [],
          artifacts: [],
        },
      ],
    });

    const adminUser: any = { id: 'admin-1', roles: ['admin'] };
    const result = await service.getWorkshopBySlug('build-http-server', 'draft', adminUser);

    expect(result.version).toBe('draft');
    expect(result.kind).toBe('draft');
  });
});
