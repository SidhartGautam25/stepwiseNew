import { z } from 'zod';
import { WorkshopSchema } from './workshop.schema.js';
import { ChapterStepItemSchema } from './chapter.schema.js';
import { TestSchema } from './test.schema.js';
import { StarterHandrailSchema } from './starter-handrail.schema.js';

export const ContentLevelSchema = z.enum(['beginner', 'intermediate', 'expert']);
export type ContentLevel = z.infer<typeof ContentLevelSchema>;

export const StepContentSchema = z.object({
  task: z.string().min(1, 'Task subsection is required'),
  theory: z.string().min(1, 'Theory subsection is required'),
  hints: z.string().optional(),
});
export type StepContent = z.infer<typeof StepContentSchema>;

export const ParsedStepSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  tests: z.array(z.string()),
  content: z.record(ContentLevelSchema, StepContentSchema),
});
export type ParsedStep = z.infer<typeof ParsedStepSchema>;

export const ParsedChapterSchema = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
  title: z.string(),
  summary: z.string(),
  estMinutes: z.number().int().positive(),
  branch: z.string(),
  commitSha: z.string(),
  intro: z.record(ContentLevelSchema, z.string()),
  steps: z.array(ParsedStepSchema),
  tests: z.record(z.string(), TestSchema),
});
export type ParsedChapter = z.infer<typeof ParsedChapterSchema>;

export const OverviewSectionsSchema = z.object({
  whatWeBuild: z.string().min(1, '"What we build" section is required'),
  whatYouLearn: z.string().min(1, '"What you will learn" section is required'),
  prerequisites: z.string().min(1, '"Prerequisites" section is required'),
  limitations: z.string().min(1, '"Limitations and scope" section is required'),
  howItWorks: z.string().min(1, '"How this workshop works" section is required'),
});
export type OverviewSections = z.infer<typeof OverviewSectionsSchema>;

export const StarterSnapshotSchema = z.object({
  language: z.string(),
  config: StarterHandrailSchema,
  files: z.record(z.string(), z.string()), // relative posix path -> sha256 or content
});
export type StarterSnapshot = z.infer<typeof StarterSnapshotSchema>;

export const WorkshopSnapshotSchema = z.object({
  workshop: WorkshopSchema,
  overview: OverviewSectionsSchema,
  chapters: z.array(ParsedChapterSchema),
  starters: z.array(StarterSnapshotSchema),
  mainSha: z.string(),
  generatedAt: z.string(),
});
export type WorkshopSnapshot = z.infer<typeof WorkshopSnapshotSchema>;
