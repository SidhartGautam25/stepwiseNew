export const QUERY_KEYS = {
  workshops: {
    all: ['workshops'] as const,
    overview: (slug: string) => ['workshops', slug] as const,
    step: (workshopSlug: string, stepSlug: string, level?: string) =>
      ['workshops', workshopSlug, 'steps', stepSlug, level || 'all'] as const,
  },
  user: {
    profile: (userId?: string) => ['user', 'profile', userId || 'current'] as const,
  },
  health: {
    services: ['health', 'services'] as const,
  },
} as const;

