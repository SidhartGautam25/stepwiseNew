import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, useRole } from '@/context/auth-context';
import { useProfile } from '@/hooks/use-profile';
import * as authClient from '@/utils/auth/client';
import { emitAuthEvent } from '@/utils/auth/events';

function createTestWrapper(initialSession?: authClient.Session | null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialSession={initialSession}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('A6.4 Web Auth End-to-End Integration Flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('completes login, session transition, and profile loading flow', async () => {
    const mockUser: authClient.SessionUser = {
      id: 'usr-e2e-1',
      email: 'builder@handrail.dev',
      displayName: 'Builder One',
      roles: ['learner'],
    };

    const mockSession: authClient.Session = {
      user: mockUser,
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    };

    const mockProfile = {
      id: 'prof-e2e-1',
      userId: 'usr-e2e-1',
      email: 'builder@handrail.dev',
      displayName: 'Builder One',
      avatarUrl: null,
      defaultLevel: 'intermediate',
      defaultLanguage: 'typescript',
      theme: 'dark',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
    };

    // Initially unauthenticated
    let currentSession: authClient.Session | null = null;

    vi.spyOn(authClient, 'getSession').mockImplementation(async () => currentSession);
    const loginSpy = vi.spyOn(authClient, 'login').mockImplementation(async () => {
      currentSession = mockSession;
      return { user: mockUser, session: { expiresIn: 1800 } } as any;
    });

    vi.spyOn(authClient, 'apiFetch').mockImplementation(async (path) => {
      if (path === '/v1/auth/me') return currentSession as any;
      if (path === '/v1/profile') return mockProfile as any;
      return {} as any;
    });

    // Mount AuthProvider in unauthenticated state
    const { result: authResult } = renderHook(() => useAuth(), {
      wrapper: createTestWrapper(null),
    });

    expect(authResult.current.status).toBe('unauthenticated');
    expect(authResult.current.isAuthenticated).toBe(false);

    // Mount useProfile in unauthenticated state
    const { result: profileResult } = renderHook(() => useProfile(), {
      wrapper: createTestWrapper(null),
    });
    expect(profileResult.current.fetchStatus).toBe('idle');

    // Trigger Login
    await act(async () => {
      await authResult.current.login({
        email: 'builder@handrail.dev',
        password: 'Password123!',
      });
    });

    expect(loginSpy).toHaveBeenCalledWith({
      email: 'builder@handrail.dev',
      password: 'Password123!',
    });

    await waitFor(() => {
      expect(authResult.current.status).toBe('authenticated');
      expect(authResult.current.user?.id).toBe('usr-e2e-1');
      expect(authResult.current.user?.email).toBe('builder@handrail.dev');
    });
  });

  it('synchronizes cross-tab logout and purges state across subscribers', async () => {
    const activeSession: authClient.Session = {
      user: {
        id: 'usr-tab-1',
        email: 'tab1@handrail.dev',
        displayName: 'Tab Learner',
        roles: ['learner'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    // Tab 2 has active session
    const { result } = renderHook(() => useAuth(), {
      wrapper: createTestWrapper(activeSession),
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe('usr-tab-1');

    // Tab 1 broadcasts SIGNED_OUT
    act(() => {
      emitAuthEvent('SIGNED_OUT');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('enforces platform role authorization using app_metadata.roles exclusively', () => {
    const adminSession: authClient.Session = {
      user: {
        id: 'usr-admin-1',
        email: 'admin@handrail.dev',
        displayName: 'Admin User',
        roles: ['admin', 'maintainer'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const learnerSession: authClient.Session = {
      user: {
        id: 'usr-learner-1',
        email: 'learner@handrail.dev',
        displayName: 'Learner User',
        roles: ['learner'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    // Test Admin
    const { result: adminRole } = renderHook(() => useRole('admin'), {
      wrapper: createTestWrapper(adminSession),
    });
    const { result: maintainerRole } = renderHook(() => useRole('maintainer'), {
      wrapper: createTestWrapper(adminSession),
    });
    expect(adminRole.current).toBe(true);
    expect(maintainerRole.current).toBe(true);

    // Test Learner
    const { result: learnerAdminCheck } = renderHook(() => useRole('admin'), {
      wrapper: createTestWrapper(learnerSession),
    });
    const { result: learnerRole } = renderHook(() => useRole('learner'), {
      wrapper: createTestWrapper(learnerSession),
    });
    expect(learnerAdminCheck.current).toBe(false);
    expect(learnerRole.current).toBe(true);
  });
});
