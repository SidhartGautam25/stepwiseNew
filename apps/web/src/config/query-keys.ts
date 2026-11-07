export const QUERY_KEYS = {
  auth: {
    session: ['auth', 'session'] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
    preferences: ['profile', 'preferences'] as const,
    activity: ['profile', 'activity'] as const,
  },
  workshops: {
    all: ['workshops'] as const,
    overview: (slug: string) => ['workshops', slug] as const,
    step: (workshopSlug: string, stepSlug: string, level?: string) =>
      ['workshops', workshopSlug, 'steps', stepSlug, level || 'all'] as const,
    progress: (slug: string) => ['workshops', slug, 'progress'] as const,
    starter: (slug: string, language: string) => ['workshops', slug, 'starter', language] as const,
  },
  user: {
    profile: (userId?: string) => ['user', 'profile', userId || 'current'] as const,
  },
  health: {
    services: ['health', 'services'] as const,
  },
} as const;
