import { z } from 'zod';

export const TestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Test ID must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1, 'Test description is required'),
  hidden: z.boolean().default(false),
  timeout_seconds: z.number().int().positive().default(30),
});

export type TestConfig = z.infer<typeof TestSchema>;
