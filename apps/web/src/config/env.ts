import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  API_INTERNAL_URL: z.string().url().default('http://localhost:4000'),
  AUTH_ACCESS_COOKIE_NAME: z.string().default('hr_at'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  API_INTERNAL_URL:
    process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  AUTH_ACCESS_COOKIE_NAME:
    process.env.AUTH_ACCESS_COOKIE_NAME ||
    (process.env.NODE_ENV === 'production' ? '__Secure-hr_at' : 'hr_at'),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
});
