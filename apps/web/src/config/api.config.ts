export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  endpoints: {
    me: '/v1/me',
    workshops: '/v1/workshops',
    workshopOverview: (slug: string) => `/v1/workshops/${slug}`,
    stepDetail: (workshopSlug: string, stepSlug: string, level?: string) =>
      `/v1/workshops/${workshopSlug}/steps/${stepSlug}${level ? `?level=${level}` : ''}`,
    enroll: (slug: string) => `/v1/workshops/${slug}/enroll`,
    workshopProgress: (slug: string) => `/v1/workshops/${slug}/progress`,
    starterInfo: (slug: string, language: string) => `/v1/starters/${slug}/${language}`,
    realtimeEvents: '/v1/realtime/events',
    healthGateway: '/health',
  },
  headers: {
    correlationId: 'x-correlation-id',
    authorization: 'Authorization',
  },
  timeoutMs: 15000,
} as const;
