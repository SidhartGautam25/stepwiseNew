import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string().default('authenticated'),
  appMetadata: z.record(z.unknown()).optional(),
  userMetadata: z.record(z.unknown()).optional(),
});

export type UserDto = z.infer<typeof UserSchema>;

export const AuthUserHeaderSchema = z.object({
  'x-user-id': z.string().uuid(),
  'x-user-email': z.string().email(),
});

export type AuthUserHeaders = z.infer<typeof AuthUserHeaderSchema>;
