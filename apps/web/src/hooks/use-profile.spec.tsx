import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/auth-context';
import {
  useProfile,
  useUpdateProfile,
  usePreferences,
  useUpdatePreferences,
  useActivity,
} from './use-profile';
import * as authClient from '@/utils/auth/client';

function createWrapper(session: authClient.Session | null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialSession={session}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

const mockSession: authClient.Session = {
  user: {
    id: 'usr-456',
    email: 'learner@handrail.dev',
    displayName: 'Learner One',
    roles: ['learner'],
  },
  expiresAt: Math.floor(Date.now() / 1000) + 900,
};

describe('A6.2 Profile & Preferences Hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authClient, 'getSession').mockResolvedValue(mockSession);
  });

  it('useProfile does not run when unauthenticated', async () => {
    const apiFetchSpy = vi.spyOn(authClient, 'apiFetch');

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(null),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(apiFetchSpy).not.toHaveBeenCalled();
  });

  it('useProfile fetches profile when authenticated', async () => {
    const mockProfile = {
      id: 'prof-1',
      userId: 'usr-456',
      email: 'learner@handrail.dev',
      displayName: 'Learner One',
      avatarUrl: null,
      defaultLevel: 'beginner',
      defaultLanguage: 'typescript',
      theme: 'dark',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    const apiFetchSpy = vi
      .spyOn(authClient, 'apiFetch')
      .mockImplementation(async (path) => {
        if (path === '/v1/auth/me') return mockSession;
        if (path === '/v1/profile') return mockProfile as any;
        return {} as any;
      });

    const { result } = renderHook(() => useProfile(), {
      wrapper: createWrapper(mockSession),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProfile);
    expect(apiFetchSpy).toHaveBeenCalledWith('/v1/profile');
  });

  it('useUpdateProfile mutates profile and updates cache', async () => {
    const updatedProfile = {
      id: 'prof-1',
      userId: 'usr-456',
      email: 'learner@handrail.dev',
      displayName: 'Updated Name',
      avatarUrl: null,
      defaultLevel: 'beginner',
      defaultLanguage: 'typescript',
      theme: 'dark',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    const apiFetchSpy = vi
      .spyOn(authClient, 'apiFetch')
      .mockImplementation(async (path) => {
        if (path === '/v1/auth/me') return mockSession;
        if (path === '/v1/profile') return updatedProfile as any;
        return {} as any;
      });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(mockSession),
    });

    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Updated Name' });
    });

    expect(apiFetchSpy).toHaveBeenCalledWith('/v1/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Updated Name' }),
    });

    await waitFor(() => expect(result.current.data).toEqual(updatedProfile));
  });

  it('usePreferences fetches preferences correctly', async () => {
    const mockPrefs = {
      defaultLevel: 'intermediate',
      defaultLanguage: 'go',
      theme: 'system',
    };

    const apiFetchSpy = vi
      .spyOn(authClient, 'apiFetch')
      .mockImplementation(async (path) => {
        if (path === '/v1/auth/me') return mockSession;
        if (path === '/v1/preferences') return mockPrefs as any;
        return {} as any;
      });

    const { result } = renderHook(() => usePreferences(), {
      wrapper: createWrapper(mockSession),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockPrefs);
    expect(apiFetchSpy).toHaveBeenCalledWith('/v1/preferences');
  });

  it('useUpdatePreferences sends PATCH with new preferences', async () => {
    const updatedPrefs = {
      defaultLevel: 'expert',
      defaultLanguage: 'rust',
      theme: 'dark',
    };

    const apiFetchSpy = vi
      .spyOn(authClient, 'apiFetch')
      .mockImplementation(async (path) => {
        if (path === '/v1/auth/me') return mockSession;
        if (path === '/v1/preferences') return updatedPrefs as any;
        return {} as any;
      });

    const { result } = renderHook(() => useUpdatePreferences(), {
      wrapper: createWrapper(mockSession),
    });

    await act(async () => {
      await result.current.mutateAsync({ defaultLevel: 'expert', defaultLanguage: 'rust' });
    });

    expect(apiFetchSpy).toHaveBeenCalledWith('/v1/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ defaultLevel: 'expert', defaultLanguage: 'rust' }),
    });

    await waitFor(() => expect(result.current.data).toEqual(updatedPrefs));
  });

  it('useActivity fetches recent activity entries', async () => {
    const mockActivities = [
      {
        id: 'act-1',
        userId: 'usr-456',
        action: 'WORKSHOP_ENROLLED',
        metadata: { slug: 'containers' },
        createdAt: '2026-11-01T12:00:00.000Z',
      },
    ];

    const apiFetchSpy = vi
      .spyOn(authClient, 'apiFetch')
      .mockImplementation(async (path) => {
        if (path === '/v1/auth/me') return mockSession;
        if (path === '/v1/activity') return mockActivities as any;
        return {} as any;
      });

    const { result } = renderHook(() => useActivity(), {
      wrapper: createWrapper(mockSession),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockActivities);
    expect(apiFetchSpy).toHaveBeenCalledWith('/v1/activity');
  });
});
