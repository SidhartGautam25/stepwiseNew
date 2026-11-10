import { z } from 'zod';

export const ChapterStepItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Step ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Step title is required'),
  tests: z.array(z.string().min(1)).min(1, 'Each step must list at least one test ID'),
});

export type ChapterStepItem = z.infer<typeof ChapterStepItemSchema>;

export const ChapterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Chapter ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Chapter title is required'),
  summary: z.string().min(1, 'Chapter summary is required'),
  est_minutes: z.number().int().positive('Estimated minutes must be positive'),
  steps: z.array(ChapterStepItemSchema).min(1, 'Chapter must declare at least one step'),
});

export type ChapterConfig = z.infer<typeof ChapterSchema>;
