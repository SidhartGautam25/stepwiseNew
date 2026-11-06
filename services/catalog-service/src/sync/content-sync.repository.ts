import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import type { ContentKind, ContentLevel } from '@app/contracts';

export interface UpsertWorkshopDto {
  slug: string;
  title: string;
  summary: string;
  difficulty: string;
  estimatedTime: string;
  prerequisites: string[];
  limitations: string[];
  whatWeBuild: string;
  whatYouLearn: string[];
}

export interface UpsertChapterDto {
  workshopId: string;
  slug: string;
  title: string;
  summary?: string;
  orderIndex: number;
}

export interface UpsertStepDto {
  chapterId: string;
  slug: string;
  title: string;
  globalOrder: number;
}

export interface UpsertStepTestDto {
  stepId: string;
  testId: string;
  description: string;
  isHidden?: boolean;
}

export interface UpsertStepContentDto {
  stepId: string;
  kind: ContentKind;
  level: ContentLevel;
  mdx: string;
}

@Injectable()
export class ContentSyncRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async upsertWorkshop(data: UpsertWorkshopDto) {
    return this.prisma.workshop.upsert({
      where: { slug: data.slug },
      update: {
        title: data.title,
        summary: data.summary,
        difficulty: data.difficulty,
        estimatedTime: data.estimatedTime,
        prerequisites: data.prerequisites,
        limitations: data.limitations,
        whatWeBuild: data.whatWeBuild,
        whatYouLearn: data.whatYouLearn,
      },
      create: {
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        difficulty: data.difficulty,
        estimatedTime: data.estimatedTime,
        prerequisites: data.prerequisites,
        limitations: data.limitations,
        whatWeBuild: data.whatWeBuild,
        whatYouLearn: data.whatYouLearn,
      },
    });
  }

  async upsertWorkshopLanguage(workshopId: string, language: string) {
    return this.prisma.workshopLanguage.upsert({
      where: {
        workshopId_language: {
          workshopId,
          language,
        },
      },
      update: {},
      create: {
        workshopId,
        language,
      },
    });
  }

  async upsertChapter(data: UpsertChapterDto) {
    return this.prisma.chapter.upsert({
      where: {
        workshopId_slug: {
          workshopId: data.workshopId,
          slug: data.slug,
        },
      },
      update: {
        title: data.title,
        summary: data.summary || '',
        orderIndex: data.orderIndex,
      },
      create: {
        workshopId: data.workshopId,
        slug: data.slug,
        title: data.title,
        summary: data.summary || '',
        orderIndex: data.orderIndex,
      },
    });
  }

  async upsertStep(data: UpsertStepDto) {
    return this.prisma.step.upsert({
      where: {
        chapterId_slug: {
          chapterId: data.chapterId,
          slug: data.slug,
        },
      },
      update: {
        title: data.title,
        globalOrder: data.globalOrder,
      },
      create: {
        chapterId: data.chapterId,
        slug: data.slug,
        title: data.title,
        globalOrder: data.globalOrder,
      },
    });
  }

  async upsertStepTest(data: UpsertStepTestDto) {
    return this.prisma.stepTest.upsert({
      where: {
        stepId_testId: {
          stepId: data.stepId,
          testId: data.testId,
        },
      },
      update: {
        description: data.description,
        isHidden: data.isHidden ?? false,
      },
      create: {
        stepId: data.stepId,
        testId: data.testId,
        description: data.description,
        isHidden: data.isHidden ?? false,
      },
    });
  }

  async upsertStepContent(data: UpsertStepContentDto) {
    return this.prisma.stepContent.upsert({
      where: {
        stepId_kind_level: {
          stepId: data.stepId,
          kind: data.kind as any,
          level: data.level as any,
        },
      },
      update: { mdx: data.mdx },
      create: {
        stepId: data.stepId,
        kind: data.kind as any,
        level: data.level as any,
        mdx: data.mdx,
      },
    });
  }
}
