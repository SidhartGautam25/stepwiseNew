'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api-client';
import { API_CONFIG } from '../config/api.config';
import { QUERY_KEYS } from '../config/query-keys';
import type { WorkshopOverviewDto } from '@app/contracts';

export function useWorkshopOverview(slug: string) {
  const query = useQuery<WorkshopOverviewDto, Error>({
    queryKey: QUERY_KEYS.workshops.overview(slug),
    queryFn: () =>
      apiRequest<WorkshopOverviewDto>(API_CONFIG.endpoints.workshopOverview(slug)),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });

  return {
    workshop: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

