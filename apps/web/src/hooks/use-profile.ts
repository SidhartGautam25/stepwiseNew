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

export interface UserEnrollment {
  id: string;
  userId: string;
  workshopSlug: string;
  language: string;
  enrolledAt: string;
  steps: Array<{
    id: string;
    stepSlug: string;
    globalOrder: number;
    status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED';
    completedAt?: string | null;
  }>;
}

export function useUserEnrollments() {
  const { status, session } = useAuth();

  return useQuery<UserEnrollment[], Error>({
    queryKey: ['profile', 'enrollments'],
    queryFn: async () => {
      try {
        const rawProgress = await apiFetch<UserEnrollment[]>('/v1/progress');
        const enrollments: UserEnrollment[] = Array.isArray(rawProgress) ? [...rawProgress] : [];

        // Also query payment-service purchase history via gateway
        try {
          const payments = await apiFetch<Array<{ workshopSlug: string; status: string; createdAt?: string }>>(
            '/v1/payments/history',
          );
          if (Array.isArray(payments)) {
            const paidOrders = payments.filter((p) => p.status === 'PAID');
            for (const order of paidOrders) {
              if (!enrollments.some((e) => e.workshopSlug === order.workshopSlug)) {
                // Ensure purchased workshop appears in the dashboard even while async enrollment completes
                enrollments.push({
                  id: `order-${order.workshopSlug}`,
                  userId: session?.user?.id || '',
                  workshopSlug: order.workshopSlug,
                  language: 'typescript',
                  enrolledAt: order.createdAt || new Date().toISOString(),
                  steps: [
                    { id: 'step-1', stepSlug: 'step-1', globalOrder: 1, status: 'AVAILABLE' },
                    { id: 'step-2', stepSlug: 'step-2', globalOrder: 2, status: 'LOCKED' },
                    { id: 'step-3', stepSlug: 'step-3', globalOrder: 3, status: 'LOCKED' },
                    { id: 'step-4', stepSlug: 'step-4', globalOrder: 4, status: 'LOCKED' },
                    { id: 'step-5', stepSlug: 'step-5', globalOrder: 5, status: 'LOCKED' },
                  ],
                });

                // Trigger self-healing background enrollment on profile-service
                apiFetch(`/v1/workshops/${order.workshopSlug}/enroll`, {
                  method: 'POST',
                  body: JSON.stringify({ language: 'typescript' }),
                }).catch(() => {});
              }
            }
          }
        } catch {
          // If payment history fetch is unavailable, fallback to progress enrollments
        }

        return enrollments;
      } catch {
        return [];
      }
    },
    enabled: status !== 'loading',
    staleTime: 10 * 1000,
  });
}

