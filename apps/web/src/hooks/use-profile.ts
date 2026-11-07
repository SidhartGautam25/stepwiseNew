'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/auth/client';
import { QUERY_KEYS } from '@/config/query-keys';
import { useAuth } from '@/context/auth-context';

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  defaultLevel: string;
  defaultLanguage: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  defaultLevel: string;
  defaultLanguage: string;
  theme: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export function useProfile() {
  const { session, status } = useAuth();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  return useQuery<UserProfile, Error>({
    queryKey: QUERY_KEYS.profile.me,
    queryFn: () => apiFetch<UserProfile>('/v1/profile'),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<
    UserProfile,
    Error,
    { displayName?: string; avatarUrl?: string }
  >({
    mutationFn: (body) =>
      apiFetch<UserProfile>('/v1/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(QUERY_KEYS.profile.me, updatedProfile);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.me });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auth.session });
    },
  });
}

export function usePreferences() {
  const { session, status } = useAuth();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  return useQuery<UserPreferences, Error>({
    queryKey: QUERY_KEYS.profile.preferences,
    queryFn: () => apiFetch<UserPreferences>('/v1/preferences'),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation<
    UserPreferences,
    Error,
    { defaultLevel?: string; defaultLanguage?: string; theme?: string }
  >({
    mutationFn: (body) =>
      apiFetch<UserPreferences>('/v1/preferences', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (updatedPreferences) => {
      queryClient.setQueryData(
        QUERY_KEYS.profile.preferences,
        updatedPreferences,
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.preferences });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.me });
    },
  });
}

export function useActivity() {
  const { session, status } = useAuth();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  return useQuery<UserActivity[], Error>({
    queryKey: QUERY_KEYS.profile.activity,
    queryFn: () => apiFetch<UserActivity[]>('/v1/activity'),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}
