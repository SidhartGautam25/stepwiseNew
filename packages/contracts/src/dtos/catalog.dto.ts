import { z } from 'zod';

export const ContentLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export type ContentLevel = z.infer<typeof ContentLevelSchema>;

export const ContentKindSchema = z.enum(['task', 'theory', 'hint']);
export type ContentKind = z.infer<typeof ContentKindSchema>;

export const StepTestSchema = z.object({
  testId: z.string(),
  description: z.string(),
  isHidden: z.boolean().default(false),
});
export type StepTestDto = z.infer<typeof StepTestSchema>;

export const StepSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  globalOrder: z.number(),
  testCount: z.number(),
});
export type StepSummaryDto = z.infer<typeof StepSummarySchema>;

export const ChapterSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  orderIndex: z.number(),
  steps: z.array(StepSummarySchema),
});
export type ChapterSummaryDto = z.infer<typeof ChapterSummarySchema>;

export const WorkshopSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  difficulty: z.string(),
  estimatedTime: z.string(),
  languages: z.array(z.string()),
  totalSteps: z.number(),
});
export type WorkshopSummaryDto = z.infer<typeof WorkshopSummarySchema>;

export const WorkshopOverviewSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  difficulty: z.string(),
  estimatedTime: z.string(),
  prerequisites: z.array(z.string()),
  limitations: z.array(z.string()),
  whatWeBuild: z.string(),
  whatYouLearn: z.array(z.string()),
  languages: z.array(z.string()),
  totalSteps: z.number(),
  overviewMdx: z.string().optional(),
  chapters: z.array(ChapterSummarySchema),
});
export type WorkshopOverviewDto = z.infer<typeof WorkshopOverviewSchema>;

export const StepDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  globalOrder: z.number(),
  workshopSlug: z.string(),
  chapterSlug: z.string(),
  currentLevel: ContentLevelSchema,
  taskMdx: z.string(),
  theoryMdx: z.string(),
  hintsMdx: z.string().optional(),
  allLevelsContent: z
    .record(
      ContentLevelSchema,
      z.object({
        task: z.string(),
        theory: z.string(),
        hints: z.string().optional(),
      }),
    )
    .optional(),
  tests: z.array(StepTestSchema),
});
export type StepDetailDto = z.infer<typeof StepDetailSchema>;

export const ContentSyncStepSchema = z.object({
  slug: z.string(),
  title: z.string(),
  globalOrder: z.number(),
  task: z.record(ContentLevelSchema, z.string()),
  theory: z.record(ContentLevelSchema, z.string()),
  hints: z.record(ContentLevelSchema, z.string()).optional(),
  tests: z.array(
    z.object({
      testId: z.string(),
      description: z.string(),
      isHidden: z.boolean().default(false),
    }),
  ),
});

export const ContentSyncChapterSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  orderIndex: z.number(),
  steps: z.array(ContentSyncStepSchema),
});

export const ContentSyncWorkshopSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  difficulty: z.string(),
  estimatedTime: z.string(),
  prerequisites: z.array(z.string()),
  limitations: z.array(z.string()),
  whatWeBuild: z.string(),
  whatYouLearn: z.array(z.string()),
  languages: z.array(z.string()),
  overviewMdx: z.string().optional(),
  chapters: z.array(ContentSyncChapterSchema),
});
export type ContentSyncWorkshopDto = z.infer<typeof ContentSyncWorkshopSchema>;

// --- Milestone C3 Internal Service Contracts & Gated Types ---

export const WorkshopResolveSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  latestPublishedVersionId: z.string().nullable(),
  latestVersion: z.string().nullable(),
  status: z.string(),
});
export type WorkshopResolveV1 = z.infer<typeof WorkshopResolveSchema>;

export const VersionStructureStepSchema = z.object({
  stepId: z.string(),
  stepKey: z.string(),
  orderInChapter: z.number(),
  title: z.string(),
});
export type VersionStructureStepV1 = z.infer<typeof VersionStructureStepSchema>;

export const VersionStructureChapterSchema = z.object({
  chapterId: z.string(),
  chapterKey: z.string(),
  orderNo: z.number(),
  title: z.string(),
  estMinutes: z.number().nullable(),
  steps: z.array(VersionStructureStepSchema),
});
export type VersionStructureChapterV1 = z.infer<typeof VersionStructureChapterSchema>;

export const VersionStructureSchema = z.object({
  versionId: z.string(),
  workshopSlug: z.string(),
  version: z.string(),
  chapters: z.array(VersionStructureChapterSchema),
});
export type VersionStructureV1 = z.infer<typeof VersionStructureSchema>;

export const TestBundleRefStepTestSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  hidden: z.boolean(),
});
export type TestBundleRefStepTestV1 = z.infer<typeof TestBundleRefStepTestSchema>;

export const TestBundleRefStepSchema = z.object({
  stepKey: z.string(),
  tests: z.array(TestBundleRefStepTestSchema),
});
export type TestBundleRefStepV1 = z.infer<typeof TestBundleRefStepSchema>;

export const TestBundleRefSchema = z.object({
  url: z.string(),
  sha256: z.string(),
  size: z.number(),
  expiresAt: z.string(),
  chapterKey: z.string(),
  steps: z.array(TestBundleRefStepSchema),
});
export type TestBundleRefV1 = z.infer<typeof TestBundleRefSchema>;

export const AccessCheckSchema = z.object({
  enrolled: z.boolean(),
  versionId: z.string().optional(),
  unlockedChapters: z.array(z.string()),
  currentChapterId: z.string().optional(),
});
export type AccessCheckV1 = z.infer<typeof AccessCheckSchema>;

export const StarterDownloadUrlSchema = z.object({
  url: z.string(),
  filename: z.string(),
  language: z.string(),
  version: z.string(),
  expiresAt: z.string(),
});
export type StarterDownloadUrlV1 = z.infer<typeof StarterDownloadUrlSchema>;

export const GatedChapterContentSchema = z.object({
  id: z.string(),
  workshopSlug: z.string(),
  version: z.string(),
  orderNo: z.number(),
  chapterKey: z.string(),
  title: z.string(),
  summary: z.string(),
  level: ContentLevelSchema,
  introMd: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      stepKey: z.string(),
      title: z.string(),
      orderInChapter: z.number(),
    }),
  ),
});
export type GatedChapterContentDto = z.infer<typeof GatedChapterContentSchema>;

export const GatedStepContentSchema = z.object({
  id: z.string(),
  workshopSlug: z.string(),
  chapterKey: z.string(),
  version: z.string(),
  orderInChapter: z.number(),
  stepKey: z.string(),
  title: z.string(),
  level: ContentLevelSchema,
  taskMd: z.string(),
  theoryMd: z.string(),
  hintsMd: z.string().optional(),
});
export type GatedStepContentDto = z.infer<typeof GatedStepContentSchema>;


