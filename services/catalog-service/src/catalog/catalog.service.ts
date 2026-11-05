import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type {
  WorkshopSummaryDto,
  WorkshopOverviewDto,
  StepDetailDto,
  ContentLevel,
} from '@app/contracts';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listWorkshops(): Promise<WorkshopSummaryDto[]> {
    const workshops = await this.prisma.workshop.findMany({
      include: {
        languages: true,
        chapters: {
          include: {
            steps: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return workshops.map((w) => {
      const totalSteps = w.chapters.reduce((sum, ch) => sum + ch.steps.length, 0);
      return {
        id: w.id,
        slug: w.slug,
        title: w.title,
        summary: w.summary,
        difficulty: w.difficulty,
        estimatedTime: w.estimatedTime,
        languages: w.languages.map((l) => l.language),
        totalSteps,
      };
    });
  }

  async getWorkshopOverview(slug: string): Promise<WorkshopOverviewDto> {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug },
      include: {
        languages: true,
        chapters: {
          orderBy: { orderIndex: 'asc' },
          include: {
            steps: {
              orderBy: { globalOrder: 'asc' },
              include: {
                tests: true,
              },
            },
          },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop with slug "${slug}" not found`);
    }

    const totalSteps = workshop.chapters.reduce((sum, ch) => sum + ch.steps.length, 0);

    return {
      id: workshop.id,
      slug: workshop.slug,
      title: workshop.title,
      summary: workshop.summary,
      difficulty: workshop.difficulty,
      estimatedTime: workshop.estimatedTime,
      prerequisites: workshop.prerequisites,
      limitations: workshop.limitations,
      whatWeBuild: workshop.whatWeBuild,
      whatYouLearn: workshop.whatYouLearn,
      languages: workshop.languages.map((l) => l.language),
      totalSteps,
      chapters: workshop.chapters.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        title: ch.title,
        summary: ch.summary,
        orderIndex: ch.orderIndex,
        steps: ch.steps.map((s) => ({
          id: s.id,
          slug: s.slug,
          title: s.title,
          globalOrder: s.globalOrder,
          testCount: s.tests.length,
        })),
      })),
    };
  }

  async getStepDetail(
    workshopSlug: string,
    stepSlug: string,
    preferredLevel: ContentLevel = 'intermediate',
  ): Promise<StepDetailDto> {
    const workshop = await this.prisma.workshop.findUnique({
      where: { slug: workshopSlug },
      include: {
        chapters: {
          include: {
            steps: {
              where: { slug: stepSlug },
              include: {
                tests: true,
                contents: true,
              },
            },
          },
        },
      },
    });

    if (!workshop) {
      throw new NotFoundException(`Workshop "${workshopSlug}" not found`);
    }

    let foundStep: any = null;
    let foundChapter: any = null;
    for (const chapter of workshop.chapters) {
      if (chapter.steps.length > 0) {
        foundStep = chapter.steps[0];
        foundChapter = chapter;
        break;
      }
    }

    if (!foundStep) {
      throw new NotFoundException(`Step "${stepSlug}" not found in workshop "${workshopSlug}"`);
    }

    // Build all-levels map for instant prefetching & client-side level switching
    const levels: ContentLevel[] = ['beginner', 'intermediate', 'expert'];
    const allLevelsContent: Record<ContentLevel, { task: string; theory: string; hints?: string }> = {
      beginner: { task: '', theory: '' },
      intermediate: { task: '', theory: '' },
      expert: { task: '', theory: '' },
    };

    for (const item of foundStep.contents) {
      const lvl = item.level as ContentLevel;
      if (allLevelsContent[lvl]) {
        if (item.kind === 'task') allLevelsContent[lvl].task = item.mdx;
        if (item.kind === 'theory') allLevelsContent[lvl].theory = item.mdx;
        if (item.kind === 'hint') allLevelsContent[lvl].hints = item.mdx;
      }
    }

    const currentContent = allLevelsContent[preferredLevel] || allLevelsContent.intermediate;

    return {
      id: foundStep.id,
      slug: foundStep.slug,
      title: foundStep.title,
      globalOrder: foundStep.globalOrder,
      workshopSlug,
      chapterSlug: foundChapter.slug,
      currentLevel: preferredLevel,
      taskMdx: currentContent.task,
      theoryMdx: currentContent.theory,
      hintsMdx: currentContent.hints,
      allLevelsContent,
      tests: foundStep.tests.map((t: any) => ({
        testId: t.testId,
        description: t.description,
        isHidden: t.isHidden,
      })),
    };
  }
}

