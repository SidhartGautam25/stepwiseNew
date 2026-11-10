import { z } from 'zod';

export const WorkshopSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimated_hours: z.number().int().positive('Estimated hours must be positive'),
  access: z.enum(['free', 'paid']).default('free'),
  languages: z.array(z.string().min(1)).min(1, 'At least one language is required'),
  prerequisites: z.array(z.string()).default([]),
  chapters: z.array(z.string().min(1)).min(1, 'At least one chapter id is required'),
});

export type WorkshopConfig = z.infer<typeof WorkshopSchema>;
