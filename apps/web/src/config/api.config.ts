export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  endpoints: {
    me: '/v1/me',
    workshops: '/v1/workshops',
    workshopOverview: (slug: string) => `/v1/workshops/${slug}`,
    stepDetail: (workshopSlug: string, stepSlug: string, level?: string) =>
      `/v1/workshops/${workshopSlug}/steps/${stepSlug}${level ? `?level=${level}` : ''}`,
    realtimeEvents: '/v1/realtime/events',
    healthGateway: '/health',
  },
  headers: {
    correlationId: 'x-correlation-id',
    authorization: 'Authorization',
  },
  timeoutMs: 15000,
} as const;

