import { z } from 'zod';

export const StepStatusSchema = z.enum(['LOCKED', 'AVAILABLE', 'COMPLETED']);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const EnrollRequestSchema = z.object({
  language: z.string().min(1, 'Language must be specified'),
});
export type EnrollRequestDto = z.infer<typeof EnrollRequestSchema>;

export const StepProgressItemSchema = z.object({
  id: z.string(),
  stepSlug: z.string(),
  globalOrder: z.number(),
  status: StepStatusSchema,
  completedAt: z.string().nullable().optional(),
});
export type StepProgressItemDto = z.infer<typeof StepProgressItemSchema>;

export const EnrollResponseSchema = z.object({
  enrollmentId: z.string(),
  workshopSlug: z.string(),
  language: z.string(),
  firstStep: z.object({
    slug: z.string(),
    title: z.string(),
    globalOrder: z.number(),
  }),
  steps: z.array(StepProgressItemSchema),
});
export type EnrollResponseDto = z.infer<typeof EnrollResponseSchema>;

export const WorkshopProgressResponseSchema = z.object({
  isEnrolled: z.boolean(),
  enrollmentId: z.string().nullable(),
  workshopSlug: z.string(),
  language: z.string().nullable(),
  enrolledAt: z.string().nullable().optional(),
  steps: z.array(StepProgressItemSchema),
});
export type WorkshopProgressResponseDto = z.infer<typeof WorkshopProgressResponseSchema>;

