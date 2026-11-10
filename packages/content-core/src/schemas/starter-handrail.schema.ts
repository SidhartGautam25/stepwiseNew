import { z } from 'zod';

export const StarterHandrailSchema = z.object({
  build: z.array(z.string()).min(1, 'Build command array is required'),
  run: z.object({
    default: z.array(z.string()).min(1, 'Default run command array is required'),
    windows: z.array(z.string()).optional(),
    darwin: z.array(z.string()).optional(),
    linux: z.array(z.string()).optional(),
  }),
});

export type StarterHandrailConfig = z.infer<typeof StarterHandrailSchema>;
