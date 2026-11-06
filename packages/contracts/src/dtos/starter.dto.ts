import { z } from 'zod';

export const StarterInstructionsSchema = z.object({
  gitInit: z.string(),
  gitAdd: z.string(),
  gitCommit: z.string(),
  gitBranch: z.string(),
  gitRemote: z.string(),
  gitPush: z.string(),
});
export type StarterInstructionsDto = z.infer<typeof StarterInstructionsSchema>;

export const StarterInfoResponseSchema = z.object({
  workshopSlug: z.string(),
  language: z.string(),
  version: z.string(),
  checksum: z.string(),
  fileSize: z.number(),
  downloadUrl: z.string(),
  instructions: StarterInstructionsSchema,
});
export type StarterInfoResponseDto = z.infer<typeof StarterInfoResponseSchema>;

