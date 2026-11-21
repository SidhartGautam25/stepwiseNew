'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/auth/client';
import { API_CONFIG } from '../config/api.config';
import { QUERY_KEYS } from '../config/query-keys';
import type {
  WorkshopProgressResponseDto,
  EnrollResponseDto,
  StarterInfoResponseDto,
} from '@app/contracts';

export function useEnrollment(workshopSlug: string) {
  const queryClient = useQueryClient();

  const [activeStarter, setActiveStarter] = useState<StarterInfoResponseDto | null>(null);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);

  // 1. Fetch current user progress for workshop (uses session cookie via apiFetch)
  const progressQuery = useQuery<WorkshopProgressResponseDto, Error>({
    queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
    queryFn: async () => {
      return apiFetch<WorkshopProgressResponseDto>(
        API_CONFIG.endpoints.workshopProgress(workshopSlug),
        { method: 'GET' },
      );
    },
    enabled: Boolean(workshopSlug),
    staleTime: 30 * 1000,
  });

  // 2. Enroll Mutation
  const enrollMutation = useMutation<EnrollResponseDto, Error, { language: string }>({
    mutationFn: async ({ language }) => {
      // 1. Enroll user in profile-service
      const enrollRes = await apiFetch<EnrollResponseDto>(
        API_CONFIG.endpoints.enroll(workshopSlug),
        {
          method: 'POST',
          body: JSON.stringify({ language }),
        },
      );

      // 2. Fetch starter metadata with signed download URL from starter-service
      const starterRes = await apiFetch<StarterInfoResponseDto>(
        API_CONFIG.endpoints.starterInfo(workshopSlug, language),
        { method: 'GET' },
      );

      setActiveStarter(starterRes);
      setDownloadModalOpen(true);
      return enrollRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
      });
      queryClient.invalidateQueries({
        queryKey: ['profile', 'enrollments'],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.profile.activity,
      });
    },
  });

  // 3. Quick fetch starter info if already enrolled
  const fetchStarter = async (language: string) => {
    const starterRes = await apiFetch<StarterInfoResponseDto>(
      API_CONFIG.endpoints.starterInfo(workshopSlug, language),
      { method: 'GET' },
    );
    setActiveStarter(starterRes);
    setDownloadModalOpen(true);
    return starterRes;
  };

  return {
    progress: progressQuery.data,
    isLoadingProgress: progressQuery.isLoading,
    isEnrolled: Boolean(progressQuery.data?.isEnrolled ?? (progressQuery.data as any)?.id),
    enrolledLanguage: progressQuery.data?.language,
    enroll: (language: string) => enrollMutation.mutateAsync({ language }),
    isEnrolling: enrollMutation.isPending,
    enrollError: enrollMutation.error,
    starterInfo: activeStarter,
    fetchStarter,
    isDownloadModalOpen,
    setDownloadModalOpen,
    refetchProgress: progressQuery.refetch,
  };
}

