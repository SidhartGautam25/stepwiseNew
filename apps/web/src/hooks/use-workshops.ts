'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api-client';
import { API_CONFIG } from '../config/api.config';
import { QUERY_KEYS } from '../config/query-keys';
import type { WorkshopSummaryDto } from '@app/contracts';

export function useWorkshops() {
  const query = useQuery<WorkshopSummaryDto[], Error>({
    queryKey: QUERY_KEYS.workshops.all,
    queryFn: () => apiRequest<WorkshopSummaryDto[]>(API_CONFIG.endpoints.workshops),
    staleTime: 60 * 1000,
  });

  return {
    workshops: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

