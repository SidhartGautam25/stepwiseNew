import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { AuthenticatedUser, ContentLevel } from '@app/contracts';
import { PrismaService } from '../prisma.service.js';
import { CachedAccessPolicyService } from '../access/cached-access-policy.service.js';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: CachedAccessPolicyService,
  ) {}

  async listWorkshops() {
    const workshops = await this.prisma.workshop.findMany({
      where: {
        latestPublishedId: { not: null },
        status: 'active',
      },
      include: {
        versions: {
          where: { kind: 'published' },
          include: {
            overview: true,
            chapters: {
              include: {
                steps: { select: { id: true } },
              },
            },
            artifacts: {
              where: { kind: 'starter_zip' },
              select: { language: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workshops.map((w) => {
      const latestVer = w.versions.find((v) => v.id === w.latestPublishedId) || w.versions[0];
      const overviewJson = (latestVer?.overview?.sectionsJson as any) || {};
      const languages = [
        ...new Set(latestVer?.artifacts.map((a) => a.language).filter(Boolean) as string[]),
      ];
      const totalSteps =
        latestVer?.chapters.reduce((sum, ch) => sum + ch.steps.length, 0) || 0;

      return {
        id: w.id,
        slug: w.slug,
        title: overviewJson.whatWeBuild
          ? overviewJson.whatWeBuild.slice(0, 100).split('\n')[0]
          : w.slug,
        summary: overviewJson.howItWorks
          ? overviewJson.howItWorks.slice(0, 200)
          : '',
        version: latestVer?.version || '1.0.0',
        languages,
        totalChapters: latestVer?.chapters.length || 0,
        totalSteps,
      };
    });
  }

  async getWorkshopBySlug(
    slug: string,
    requestedVersion?: string,
    user?: AuthenticatedUser,
  ) {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        versions: {
          include: {
            overview: true,
            chapters: {
              orderBy: { orderNo: 'asc' },
              include: {
                steps: {
                  orderBy: { orderInChapter: 'asc' },
                  select: {
                    id: true,
                    stepKey: true,
                    title: true,
                    orderInChapter: true,
                  },
                },
              },
            },
            artifacts: {
              where: { kind: 'starter_zip' },
              select: { language: true },
            },
          },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    let targetVersion = requestedVersion;
    if (!targetVersion) {
      if (!workshop.latestPublishedId) {
        // If not published yet, only admin can preview
        if (!user || !user.roles?.includes('admin')) {
          throw new NotFoundException(`Workshop "${slug}" is not published yet`);
        }
        targetVersion = 'draft';
      }
    }

    if (targetVersion === 'draft') {
      const isAdmin = user?.roles?.includes('admin');
      if (!isAdmin) {
        throw new ForbiddenException('Admin role required to view draft version');
      }
    }

    const versionRow = targetVersion
      ? workshop.versions.find((v) => v.version === targetVersion)
      : workshop.versions.find((v) => v.id === workshop.latestPublishedId);

    if (!versionRow) {
      throw new NotFoundException(
        `Version "${targetVersion || 'latest'}" not found for workshop "${slug}"`,
      );
    }

    const overviewJson = (versionRow.overview?.sectionsJson as any) || {};
    const languages = [
      ...new Set(versionRow.artifacts.map((a) => a.language).filter(Boolean) as string[]),
    ];
    const totalSteps = versionRow.chapters.reduce(
      (sum, ch) => sum + ch.steps.length,
      0,
    );

    return {
      id: workshop.id,
      slug: workshop.slug,
      version: versionRow.version,
      versionId: versionRow.id,
      kind: versionRow.kind,
      languages,
      overview: {
        whatWeBuild: overviewJson.whatWeBuild || '',
        whatYouLearn: overviewJson.whatYouLearn || '',
        prerequisites: overviewJson.prerequisites || '',
        limitations: overviewJson.limitations || '',
        howItWorks: overviewJson.howItWorks || '',
      },
      chapters: versionRow.chapters.map((ch) => ({
        id: ch.id,
        orderNo: ch.orderNo,
        chapterKey: ch.chapterKey,
        title: ch.title,
        summary: ch.summary,
        estMinutes: ch.estMinutes,
        steps: ch.steps.map((st) => ({
          id: st.id,
          stepKey: st.stepKey,
          title: st.title,
          orderInChapter: st.orderInChapter,
        })),
      })),
      totalChapters: versionRow.chapters.length,
      totalSteps,
      publishedAt: versionRow.publishedAt,
    };
  }

  async getGatedChapter(
    slug: string,
    chapterIdentifier: string,
    level: ContentLevel = 'beginner',
    user?: AuthenticatedUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        versions: true,
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    // Check access with Profile Service (fail-closed if profile is unreachable)
    const access = await this.accessPolicy.checkAccess(user.id, slug);

    if (!access.enrolled) {
      throw new ForbiddenException(`You must be enrolled in "${slug}" to access chapters`);
    }

    // Pinned version or latest published
    const targetVersionId = access.versionId || workshop.latestPublishedId;
    if (!targetVersionId) {
      throw new NotFoundException(`No available published version for workshop "${slug}"`);
    }

    const version = workshop.versions.find((v) => v.id === targetVersionId);
    if (!version) {
      throw new NotFoundException(`Pinned version "${targetVersionId}" not found for "${slug}"`);
    }

    // Find chapter
    const chapter = await this.prisma.chapter.findFirst({
      where: {
        versionId: targetVersionId,
        OR: [{ id: chapterIdentifier }, { chapterKey: chapterIdentifier }],
      },
      include: {
        intros: { where: { level } },
        steps: {
          orderBy: { orderInChapter: 'asc' },
          select: {
            id: true,
            stepKey: true,
            title: true,
            orderInChapter: true,
          },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter "${chapterIdentifier}" not found in workshop "${slug}"`);
    }

    // Verify unlocked
    const isUnlocked =
      access.unlockedChapters.includes(chapter.chapterKey) ||
      access.unlockedChapters.includes(chapter.id);

    if (!isUnlocked) {
      throw new ForbiddenException(
        `Chapter "${chapter.chapterKey}" is locked. Complete preceding chapters to unlock.`,
      );
    }

    const intro = chapter.intros[0]?.md || '';

    return {
      id: chapter.id,
      workshopSlug: slug,
      version: version.version,
      orderNo: chapter.orderNo,
      chapterKey: chapter.chapterKey,
      title: chapter.title,
      summary: chapter.summary,
      level,
      introMd: intro,
      steps: chapter.steps,
    };
  }

  async getGatedStep(
    slug: string,
    chapterIdentifier: string,
    stepIdentifier: string,
    level: ContentLevel = 'beginner',
    user?: AuthenticatedUser,
  ) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: { versions: true },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${slug}" not found`);
    }

    const access = await this.accessPolicy.checkAccess(user.id, slug);

    if (!access.enrolled) {
      throw new ForbiddenException(`You must be enrolled in "${slug}" to access steps`);
    }

    const targetVersionId = access.versionId || workshop.latestPublishedId;
    if (!targetVersionId) {
      throw new NotFoundException(`No available published version for workshop "${slug}"`);
    }

    const version = workshop.versions.find((v) => v.id === targetVersionId);
    if (!version) {
      throw new NotFoundException(`Pinned version "${targetVersionId}" not found for "${slug}"`);
    }

    const chapter = await this.prisma.chapter.findFirst({
      where: {
        versionId: targetVersionId,
        OR: [{ id: chapterIdentifier }, { chapterKey: chapterIdentifier }],
      },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter "${chapterIdentifier}" not found`);
    }

    const isUnlocked =
      access.unlockedChapters.includes(chapter.chapterKey) ||
      access.unlockedChapters.includes(chapter.id);

    if (!isUnlocked) {
      throw new ForbiddenException(
        `Chapter "${chapter.chapterKey}" is locked. Complete preceding chapters to unlock.`,
      );
    }

    const step = await this.prisma.step.findFirst({
      where: {
        chapterId: chapter.id,
        OR: [{ id: stepIdentifier }, { stepKey: stepIdentifier }],
      },
      include: {
        contents: {
          where: { level },
        },
      },
    });

    if (!step) {
      throw new NotFoundException(
        `Step "${stepIdentifier}" not found in chapter "${chapter.chapterKey}"`,
      );
    }

    const taskContent = step.contents.find((c) => c.kind === 'task')?.md || '';
    const theoryContent = step.contents.find((c) => c.kind === 'theory')?.md || '';
    const hintsContent = step.contents.find((c) => c.kind === 'hint')?.md;

    return {
      id: step.id,
      workshopSlug: slug,
      chapterKey: chapter.chapterKey,
      version: version.version,
      orderInChapter: step.orderInChapter,
      stepKey: step.stepKey,
      title: step.title,
      level,
      taskMd: taskContent,
      theoryMd: theoryContent,
      hintsMd: hintsContent,
    };
  }
}
