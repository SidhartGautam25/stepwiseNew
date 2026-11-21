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
      const artifactLangs = (latestVer?.artifacts?.map((a) => a.language).filter(Boolean) as string[]) || [];
      const languages = artifactLangs.length > 0
        ? [...new Set(artifactLangs)]
        : (overviewJson.languages || ['go', 'python']);
      const totalSteps =
        latestVer?.chapters.reduce((sum, ch) => sum + ch.steps.length, 0) || 0;

      return {
        id: w.id,
        slug: w.slug,
        title: overviewJson.title || overviewJson.whatWeBuild?.slice(0, 100)?.split('\n')[0] || w.slug,
        summary: overviewJson.summary || overviewJson.howItWorks || '',
        difficulty: overviewJson.difficulty || 'Intermediate',
        estimatedTime: overviewJson.estimatedTime || overviewJson.estimated_time || '4 - 6 hours',
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
    const artifactLangs = (versionRow.artifacts?.map((a) => a.language).filter(Boolean) as string[]) || [];
    const languages = artifactLangs.length > 0
      ? [...new Set(artifactLangs)]
      : (overviewJson.languages || ['go', 'python']);
    const totalSteps = versionRow.chapters.reduce(
      (sum, ch) => sum + ch.steps.length,
      0,
    );

    let globalStepOrder = 1;
    const chapters = versionRow.chapters.map((ch) => ({
      id: ch.id,
      slug: ch.chapterKey,
      chapterKey: ch.chapterKey,
      title: ch.title,
      summary: ch.summary,
      orderIndex: ch.orderNo,
      orderNo: ch.orderNo,
      estMinutes: ch.estMinutes,
      steps: ch.steps.map((st) => ({
        id: st.id,
        slug: st.stepKey,
        stepKey: st.stepKey,
        title: st.title,
        orderInChapter: st.orderInChapter,
        globalOrder: globalStepOrder++,
        testCount: 0,
      })),
    }));

    return {
      id: workshop.id,
      slug: workshop.slug,
      title: overviewJson.title || workshop.slug,
      summary: overviewJson.summary || overviewJson.howItWorks || '',
      difficulty: overviewJson.difficulty || 'Intermediate',
      estimatedTime: overviewJson.estimatedTime || overviewJson.estimated_time || '4 - 6 hours',
      prerequisites: Array.isArray(overviewJson.prerequisites) ? overviewJson.prerequisites : [],
      limitations: Array.isArray(overviewJson.limitations) ? overviewJson.limitations : [],
      whatWeBuild: overviewJson.whatWeBuild || '',
      whatYouLearn: Array.isArray(overviewJson.whatYouLearn) ? overviewJson.whatYouLearn : [],
      languages,
      version: versionRow.version,
      versionId: versionRow.id,
      kind: versionRow.kind,
      overview: {
        whatWeBuild: overviewJson.whatWeBuild || '',
        whatYouLearn: overviewJson.whatYouLearn || '',
        prerequisites: overviewJson.prerequisites || '',
        limitations: overviewJson.limitations || '',
        howItWorks: overviewJson.howItWorks || '',
      },
      chapters,
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

    let chapter: any = null;
    if (chapterIdentifier && chapterIdentifier !== 'any') {
      chapter = await this.prisma.chapter.findFirst({
        where: {
          versionId: targetVersionId,
          OR: [{ id: chapterIdentifier }, { chapterKey: chapterIdentifier }],
        },
      });

      if (!chapter) {
        throw new NotFoundException(`Chapter "${chapterIdentifier}" not found`);
      }
    }

    const stepWhere: any = chapter
      ? {
          chapterId: chapter.id,
          OR: [{ id: stepIdentifier }, { stepKey: stepIdentifier }],
        }
      : {
          chapter: { versionId: targetVersionId },
          OR: [{ id: stepIdentifier }, { stepKey: stepIdentifier }],
        };

    const step = await this.prisma.step.findFirst({
      where: stepWhere,
      include: {
        chapter: true,
        contents: true,
      },
    });

    if (!step) {
      throw new NotFoundException(
        `Step "${stepIdentifier}" not found in workshop "${slug}"`,
      );
    }

    const activeChapter = chapter || (step as any).chapter;
    const isUnlocked = activeChapter
      ? access.unlockedChapters.includes(activeChapter.chapterKey) ||
        access.unlockedChapters.includes(activeChapter.id)
      : true;

    if (!isUnlocked) {
      throw new ForbiddenException(
        `Chapter "${activeChapter?.chapterKey}" is locked. Complete preceding chapters to unlock.`,
      );
    }

    const levelContents = step.contents.filter((c) => c.level === level);
    const taskContent =
      levelContents.find((c) => c.kind === 'task')?.md ||
      step.contents.find((c) => c.kind === 'task')?.md ||
      '';
    const theoryContent =
      levelContents.find((c) => c.kind === 'theory')?.md ||
      step.contents.find((c) => c.kind === 'theory')?.md ||
      '';
    const hintsContent =
      levelContents.find((c) => c.kind === 'hint')?.md ||
      step.contents.find((c) => c.kind === 'hint')?.md;

    const allLevelsContent: Record<string, { task: string; theory: string; hints?: string }> = {};
    for (const lvl of ['beginner', 'intermediate', 'expert'] as const) {
      const lvlItems = step.contents.filter((c) => c.level === lvl);
      allLevelsContent[lvl] = {
        task: lvlItems.find((c) => c.kind === 'task')?.md || taskContent,
        theory: lvlItems.find((c) => c.kind === 'theory')?.md || theoryContent,
        hints: lvlItems.find((c) => c.kind === 'hint')?.md || hintsContent,
      };
    }

    const activeChapterKey = activeChapter?.chapterKey || '';

    return {
      id: step.id,
      slug: step.stepKey,
      stepKey: step.stepKey,
      title: step.title,
      globalOrder: step.orderInChapter,
      workshopSlug: slug,
      chapterSlug: activeChapterKey,
      chapterKey: activeChapterKey,
      version: version.version,
      orderInChapter: step.orderInChapter,
      level,
      currentLevel: level,
      taskMd: taskContent,
      theoryMd: theoryContent,
      hintsMd: hintsContent,
      taskMdx: taskContent,
      theoryMdx: theoryContent,
      hintsMdx: hintsContent,
      allLevelsContent,
      tests: [],
    };
  }
}
