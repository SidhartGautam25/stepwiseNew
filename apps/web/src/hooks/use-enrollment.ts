'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api-client';
import { API_CONFIG } from '../config/api.config';
import { QUERY_KEYS } from '../config/query-keys';
import { useAuth } from '../context/auth-context';
import type {
  WorkshopProgressResponseDto,
  EnrollResponseDto,
  StarterInfoResponseDto,
} from '@app/contracts';

export function useEnrollment(workshopSlug: string) {
  const { token, setDevToken } = useAuth();
  const queryClient = useQueryClient();

  const [activeStarter, setActiveStarter] = useState<StarterInfoResponseDto | null>(null);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);

  // Helper to ensure an auth token (fetches local dev-token if not signed in)
  const getEffectiveToken = async (): Promise<string | null> => {
    if (token) return token;
    try {
      const res = await fetch('/api/dev-token');
      if (res.ok) {
        const data = await res.json();
        setDevToken(data.token, data.user);
        return data.token;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // 1. Fetch current user progress for workshop
  const progressQuery = useQuery<WorkshopProgressResponseDto, Error>({
    queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
    queryFn: async () => {
      const authToken = await getEffectiveToken();
      return apiRequest<WorkshopProgressResponseDto>(
        API_CONFIG.endpoints.workshopProgress(workshopSlug),
        { method: 'GET' },
        authToken,
      );
    },
    enabled: Boolean(workshopSlug),
    staleTime: 30 * 1000,
  });

  // 2. Enroll Mutation
  const enrollMutation = useMutation<EnrollResponseDto, Error, { language: string }>({
    mutationFn: async ({ language }) => {
      const authToken = await getEffectiveToken();
      // 1. Enroll user in progress-service
      const enrollRes = await apiRequest<EnrollResponseDto>(
        API_CONFIG.endpoints.enroll(workshopSlug),
        {
          method: 'POST',
          body: JSON.stringify({ language }),
        },
        authToken,
      );

      // 2. Fetch starter metadata with signed download URL from starter-service
      const starterRes = await apiRequest<StarterInfoResponseDto>(
        API_CONFIG.endpoints.starterInfo(workshopSlug, language),
        { method: 'GET' },
        authToken,
      );

      setActiveStarter(starterRes);
      setDownloadModalOpen(true);
      return enrollRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
      });
    },
  });

  // 3. Quick fetch starter info if already enrolled
  const fetchStarter = async (language: string) => {
    const authToken = await getEffectiveToken();
    const starterRes = await apiRequest<StarterInfoResponseDto>(
      API_CONFIG.endpoints.starterInfo(workshopSlug, language),
      { method: 'GET' },
      authToken,
    );
    setActiveStarter(starterRes);
    setDownloadModalOpen(true);
    return starterRes;
  };

  return {
    progress: progressQuery.data,
    isLoadingProgress: progressQuery.isLoading,
    isEnrolled: Boolean(progressQuery.data?.isEnrolled),
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

