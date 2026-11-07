import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, useRole } from './auth-context';
import * as authClient from '@/utils/auth/client';
import { emitAuthEvent } from '@/utils/auth/events';

function createWrapper(initialSession?: authClient.Session | null) {
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
        <AuthProvider initialSession={initialSession}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('A6.2 AuthContext & AuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('provides unauthenticated state when getSession returns null', async () => {
    vi.spyOn(authClient, 'getSession').mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(null),
    });

    expect(result.current.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
  });

  it('seeds authenticated session immediately from initialSession prop without layout flash', () => {
    const mockSession: authClient.Session = {
      user: {
        id: 'usr-123',
        email: 'pilot@handrail.dev',
        displayName: 'Pilot User',
        roles: ['learner', 'staff'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockSession),
    });

    expect(result.current.status).toBe('authenticated');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe('usr-123');
    expect(result.current.user?.email).toBe('pilot@handrail.dev');
    expect(result.current.hasRole('staff')).toBe(true);
    expect(result.current.hasRole('admin')).toBe(false);
  });

  it('useRole hook verifies roles accurately', () => {
    const mockSession: authClient.Session = {
      user: {
        id: 'usr-admin',
        email: 'admin@handrail.dev',
        roles: ['admin', 'maintainer'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const { result: adminRole } = renderHook(() => useRole('admin'), {
      wrapper: createWrapper(mockSession),
    });
    const { result: staffRole } = renderHook(() => useRole('staff'), {
      wrapper: createWrapper(mockSession),
    });

    expect(adminRole.current).toBe(true);
    expect(staffRole.current).toBe(false);
  });

  it('clears session on SIGNED_OUT auth event', async () => {
    const mockSession: authClient.Session = {
      user: {
        id: 'usr-active',
        email: 'active@handrail.dev',
        roles: ['learner'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockSession),
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      emitAuthEvent('SIGNED_OUT');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  it('clears session on SESSION_EXPIRED auth event', async () => {
    const mockSession: authClient.Session = {
      user: {
        id: 'usr-exp',
        email: 'exp@handrail.dev',
        roles: ['learner'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockSession),
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      emitAuthEvent('SESSION_EXPIRED');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  it('logout() calls auth client logout and resets auth state', async () => {
    const mockSession: authClient.Session = {
      user: {
        id: 'usr-logout',
        email: 'logout@handrail.dev',
        roles: ['learner'],
      },
      expiresAt: Math.floor(Date.now() / 1000) + 900,
    };

    const logoutSpy = vi.spyOn(authClient, 'logout').mockResolvedValueOnce();

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockSession),
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  it('fails fast when useAuth is called outside of AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
