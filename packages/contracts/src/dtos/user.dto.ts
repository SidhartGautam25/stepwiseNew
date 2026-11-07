import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'staff', 'learner', 'moderator']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthenticatedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.string()).default([]),
  sessionId: z.string().optional(),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string().default('authenticated'),
  roles: z.array(z.string()).default([]),
  sessionId: z.string().optional(),
  appMetadata: z.record(z.unknown()).optional(),
  userMetadata: z.record(z.unknown()).optional(),
});

export type UserDto = z.infer<typeof UserSchema>;

export const AuthUserHeaderSchema = z.object({
  'x-user-id': z.string().uuid(),
  'x-user-email': z.string().email(),
  'x-user-roles': z.string().optional(),
});

export type AuthUserHeaders = z.infer<typeof AuthUserHeaderSchema>;

export type RouteAuthMode = 'jwt' | 'public' | 'passthrough';

export const AUTH_COOKIES = {
  ACCESS_TOKEN: '__Secure-hr_at',
  REFRESH_TOKEN: '__Secure-hr_rt',
  DEV_ACCESS_TOKEN: 'hr_at',
  DEV_REFRESH_TOKEN: 'hr_rt',
  OAUTH_VERIFIER: '__Secure-hr_pkce',
  DEV_OAUTH_VERIFIER: 'hr_pkce',
} as const;

export const CSRF_HEADER_NAME = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'handrail';


