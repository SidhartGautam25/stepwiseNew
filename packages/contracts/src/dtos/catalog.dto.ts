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
