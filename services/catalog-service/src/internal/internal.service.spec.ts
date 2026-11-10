import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import {
  WorkshopResolveSchema,
  VersionStructureSchema,
  TestBundleRefSchema,
} from '@app/contracts';
import { InternalService } from './internal.service.js';
import { InternalAuthGuard } from './internal-auth.guard.js';

describe('Internal Service APIs & Guards', () => {
  let service: InternalService;
  let guard: InternalAuthGuard;
  let mockPrisma: any;
  let mockStorage: any;
  let mockConfig: any;
  let mockReflector: any;

  beforeEach(() => {
    mockPrisma = {
      workshop: {
        findUnique: vi.fn(),
      },
      workshopVersion: {
        findUnique: vi.fn(),
      },
      chapter: {
        findFirst: vi.fn(),
      },
      artifact: {
        findFirst: vi.fn(),
      },
    };
    mockStorage = {
      getSignedDownloadUrl: vi.fn().mockResolvedValue('https://minio.local/signed-tests.tar.gz?sig=xyz'),
    };
    mockConfig = {
      serviceSecret: 'test-internal-service-secret',
    };
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue('catalog:read'),
    };

    service = new InternalService(mockPrisma, mockStorage);
    guard = new InternalAuthGuard(mockReflector, mockConfig);
  });

  describe('InternalAuthGuard', () => {
    it('rejects requests missing service token with 401 Unauthorized', () => {
      const context: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      };

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('rejects invalid service token with 403 Forbidden', () => {
      const context: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-service-token': 'wrong-secret' },
          }),
        }),
      };

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('accepts valid x-service-token and populates service principal', () => {
      const req: any = {
        headers: { 'x-service-token': 'test-internal-service-secret' },
      };
      const context: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      const result = guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user.isService).toBe(true);
      expect(req.user.scopes).toContain('catalog:read');
    });
  });

  describe('InternalService Methods', () => {
    it('resolveWorkshop returns WorkshopResolveV1 compliant shape', async () => {
      mockPrisma.workshop.findUnique.mockResolvedValue({
        id: 'ws-http-1',
        slug: 'build-http-server',
        status: 'active',
        latestPublishedId: 'ver-100',
        versions: [
          {
            id: 'ver-100',
            version: '1.0.0',
            overview: {
              sectionsJson: { whatWeBuild: 'Build HTTP server from scratch' },
            },
          },
        ],
      });

      const res = await service.resolveWorkshop('build-http-server');
      const validated = WorkshopResolveSchema.parse(res);

      expect(validated.slug).toBe('build-http-server');
      expect(validated.latestVersion).toBe('1.0.0');
      expect(validated.latestPublishedVersionId).toBe('ver-100');
    });

    it('getVersionStructure returns VersionStructureV1 compliant shape for profile', async () => {
      mockPrisma.workshopVersion.findUnique.mockResolvedValue({
        id: 'ver-100',
        version: '1.0.0',
        workshop: { slug: 'build-http-server' },
        chapters: [
          {
            id: 'ch-1',
            chapterKey: '01-ping',
            orderNo: 1,
            title: 'Ping',
            estMinutes: 30,
            steps: [
              {
                id: 'st-1',
                stepKey: 'bind-socket',
                orderInChapter: 1,
                title: 'Bind Socket',
              },
            ],
          },
        ],
      });

      const res = await service.getVersionStructure('ver-100');
      const validated = VersionStructureSchema.parse(res);

      expect(validated.versionId).toBe('ver-100');
      expect(validated.chapters).toHaveLength(1);
      expect(validated.chapters[0].steps).toHaveLength(1);
    });

    it('getChapterTests generates short-lived signed URL and returns TestBundleRefV1 for verification', async () => {
      mockPrisma.chapter.findFirst.mockResolvedValue({
        id: 'ch-1',
        chapterKey: '01-ping',
        manifestJson: {
          steps: [
            {
              stepKey: 'bind-socket',
              tests: [{ id: 'test-ping-1', hidden: false }],
            },
          ],
        },
        steps: [],
      });

      mockPrisma.artifact.findFirst.mockResolvedValue({
        id: 'art-tests-1',
        storageKey: 'workshops/build-http-server/1.0.0/chapters/01-ping/tests.tar.gz',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        size: 4096,
      });

      const res = await service.getChapterTests('ver-100', '01-ping');
      const validated = TestBundleRefSchema.parse(res);

      expect(validated.url).toBe('https://minio.local/signed-tests.tar.gz?sig=xyz');
      expect(validated.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(validated.size).toBe(4096);
      expect(validated.chapterKey).toBe('01-ping');
      expect(validated.steps[0].tests[0].id).toBe('test-ping-1');
    });
  });
});
