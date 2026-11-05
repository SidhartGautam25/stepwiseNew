'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api-client';
import { API_CONFIG } from '../config/api.config';
import { QUERY_KEYS } from '../config/query-keys';
import { useLevelPreference } from './use-level-preference';
import type { StepDetailDto } from '@app/contracts';

export function useStepDetail(workshopSlug: string, stepSlug: string) {
  const { level, setLevel, metadata, availableLevels } =
    useLevelPreference(workshopSlug);

  const query = useQuery<StepDetailDto, Error>({
    queryKey: QUERY_KEYS.workshops.step(workshopSlug, stepSlug),
    queryFn: () =>
      apiRequest<StepDetailDto>(
        API_CONFIG.endpoints.stepDetail(workshopSlug, stepSlug),
      ),
    enabled: Boolean(workshopSlug && stepSlug),
    staleTime: 5 * 60 * 1000,
  });

  const step = query.data;

  // Instant client-side level adaptation from prefetched content
  const activeContent = step?.allLevelsContent?.[level] || {
    task: step?.taskMdx || '',
    theory: step?.theoryMdx || '',
    hints: step?.hintsMdx,
  };

  return {
    step,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    level,
    setLevel,
    levelMetadata: metadata,
    availableLevels,
    activeTaskMdx: activeContent.task,
    activeTheoryMdx: activeContent.theory,
    activeHintsMdx: activeContent.hints,
    tests: step?.tests || [],
  };
}

