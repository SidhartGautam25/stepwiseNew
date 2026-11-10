import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import type {
  WorkshopResolveV1,
  VersionStructureV1,
  TestBundleRefV1,
} from '@app/contracts';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async resolveWorkshop(slug: string): Promise<WorkshopResolveV1> {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        versions: {
          include: { overview: true },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    const latestVer = workshop.versions.find((v) => v.id === workshop.latestPublishedId);
    const overviewJson = (latestVer?.overview?.sectionsJson as any) || {};

    return {
      id: workshop.id,
      slug: workshop.slug,
      title: overviewJson.whatWeBuild
        ? overviewJson.whatWeBuild.slice(0, 100).split('\n')[0]
        : workshop.slug,
      latestPublishedVersionId: workshop.latestPublishedId,
      latestVersion: latestVer?.version || null,
      status: workshop.status,
    };
  }

  async getVersionStructure(versionId: string): Promise<VersionStructureV1> {
    const version = await this.prisma.workshopVersion.findUnique({
      where: { id: versionId },
      include: {
        workshop: { select: { slug: true } },
        chapters: {
          orderBy: { orderNo: 'asc' },
          include: {
            steps: {
              orderBy: { orderInChapter: 'asc' },
            },
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(`Workshop version "${versionId}" not found`);
    }

    return {
      versionId: version.id,
      workshopSlug: version.workshop.slug,
      version: version.version,
      chapters: version.chapters.map((ch) => ({
        chapterId: ch.id,
        chapterKey: ch.chapterKey,
        orderNo: ch.orderNo,
        title: ch.title,
        estMinutes: ch.estMinutes,
        steps: ch.steps.map((st) => ({
          stepId: st.id,
          stepKey: st.stepKey,
          orderInChapter: st.orderInChapter,
          title: st.title,
        })),
      })),
    };
  }

  async getChapterTests(
    versionId: string,
    chapterIdentifier: string,
  ): Promise<TestBundleRefV1> {
    const chapter = await this.prisma.chapter.findFirst({
      where: {
        versionId,
        OR: [{ id: chapterIdentifier }, { chapterKey: chapterIdentifier }],
      },
      include: {
        steps: true,
      },
    });

    if (!chapter) {
      throw new NotFoundException(
        `Chapter "${chapterIdentifier}" not found in version "${versionId}"`,
      );
    }

    const artifact = await this.prisma.artifact.findFirst({
      where: {
        versionId,
        chapterId: chapter.id,
        kind: 'test_bundle',
      },
    });

    if (!artifact) {
      throw new NotFoundException(
        `Test bundle artifact not found for chapter "${chapter.chapterKey}" in version "${versionId}"`,
      );
    }

    const signedUrl = await this.storage.getSignedDownloadUrl(artifact.storageKey, 300);

    const manifest = (chapter.manifestJson as any) || {};
    const steps =
      manifest.steps ||
      chapter.steps.map((s) => ({
        stepKey: s.stepKey,
        tests: [],
      }));

    return {
      url: signedUrl,
      sha256: artifact.sha256,
      size: artifact.size,
      expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
      chapterKey: chapter.chapterKey,
      steps,
    };
  }
}
