import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string().default('0.1.0'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponseDto = z.infer<typeof HealthResponseSchema>;

