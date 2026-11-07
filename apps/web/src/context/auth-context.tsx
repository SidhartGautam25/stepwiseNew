'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Session, SessionUser } from '@/utils/auth/client';
import * as authClient from '@/utils/auth/client';
import { subscribeAuthEvent } from '@/utils/auth/events';
import { QUERY_KEYS } from '@/config/query-keys';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextType {
  user: SessionUser | null;
  session: Session | null;
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signup: (data: { email: string; password: string }) => Promise<void>;
  logout: (opts?: { scope?: 'local' | 'global' }) => Promise<void>;
  refresh: () => Promise<boolean>;
  startGitHubOAuth: (next?: string) => void;
  hasRole: (role: string) => boolean;

  // Compatibility aliases for existing components
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  setDevToken: (token: string, simulatedUser: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Session Query via TanStack Query v5
  const {
    data: session,
    isPending,
    refetch,
  } = useQuery<Session | null>({
    queryKey: QUERY_KEYS.auth.session,
    queryFn: async () => {
      try {
        return await authClient.getSession();
      } catch {
        return null;
      }
    },
    initialData: initialSession !== undefined ? initialSession : undefined,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const refreshed = await authClient.executeSingleFlightRefresh();
    if (refreshed) {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auth.session });
    }
    return refreshed;
  }, [queryClient]);

  // 2. Schedule Proactive Token Refresh
  useEffect(() => {
    clearRefreshTimer();

    if (!session?.expiresAt) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const remainingSec = session.expiresAt - now;

    if (remainingSec <= 0) {
      // Already expired -> attempt refresh immediately
      refresh();
      return;
    }

    // Refresh 60 seconds before expiration or at 75% of remaining lifetime
    const leadSec = Math.min(60, Math.floor(remainingSec * 0.25));
    const delayMs = Math.max(5000, (remainingSec - leadSec) * 1000);

    refreshTimerRef.current = setTimeout(() => {
      refresh();
    }, delayMs);

    return () => clearRefreshTimer();
  }, [session?.expiresAt, clearRefreshTimer, refresh]);

  // 3. Tab Visibility Change Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session?.expiresAt) {
        const remainingSec = session.expiresAt - Math.floor(Date.now() / 1000);
        // If expired or within 60s of expiring, proactively refresh
        if (remainingSec <= 60) {
          refresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.expiresAt, refresh]);

  // 4. In-Tab & Cross-Tab Auth Event Bus Subscription
  useEffect(() => {
    const unsubscribe = subscribeAuthEvent((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.auth.session });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.me });
      } else if (event === 'SIGNED_OUT' || event === 'SESSION_EXPIRED') {
        clearRefreshTimer();
        queryClient.setQueryData(QUERY_KEYS.auth.session, null);
        queryClient.removeQueries({ queryKey: ['profile'] });
      }
    });

    return () => {
      unsubscribe();
      clearRefreshTimer();
    };
  }, [queryClient, clearRefreshTimer]);

  // 5. Auth Actions
  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      await authClient.login(credentials);
      await refetch();
    },
    [refetch],
  );

  const signup = useCallback(
    async (data: { email: string; password: string }) => {
      await authClient.signup(data);
      await refetch();
    },
    [refetch],
  );

  const logout = useCallback(
    async (opts?: { scope?: 'local' | 'global' }) => {
      clearRefreshTimer();
      await authClient.logout({ global: opts?.scope === 'global' });
      queryClient.setQueryData(QUERY_KEYS.auth.session, null);
      queryClient.removeQueries({ queryKey: ['profile'] });
    },
    [clearRefreshTimer, queryClient],
  );

  const startGitHubOAuth = useCallback((next?: string) => {
    authClient.startGitHubOAuth(next);
  }, []);

  const hasRole = useCallback(
    (role: string): boolean => {
      return Boolean(session?.user?.roles?.includes(role));
    },
    [session?.user?.roles],
  );

  // Backward compatibility methods
  const signInWithEmail = useCallback(
    async (email: string, password = 'password123') => {
      await login({ email, password });
    },
    [login],
  );

  const signInWithGitHub = useCallback(async () => {
    startGitHubOAuth('/dashboard');
  }, [startGitHubOAuth]);

  const signOut = useCallback(async () => {
    await logout();
  }, [logout]);

  const setDevToken = useCallback(
    (_token: string, simulatedUser: any) => {
      queryClient.setQueryData(QUERY_KEYS.auth.session, {
        user: simulatedUser,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
    },
    [queryClient],
  );

  // Status calculation
  const status: AuthStatus = isPending
    ? 'loading'
    : session?.user
      ? 'authenticated'
      : 'unauthenticated';

  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session: session ?? null,
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      token: null, // Tokens are strictly HttpOnly and never exposed to client JS
      login,
      signup,
      logout,
      refresh,
      startGitHubOAuth,
      hasRole,
      signInWithEmail,
      signInWithGitHub,
      signOut,
      setDevToken,
    }),
    [
      session,
      status,
      login,
      signup,
      logout,
      refresh,
      startGitHubOAuth,
      hasRole,
      signInWithEmail,
      signInWithGitHub,
      signOut,
      setDevToken,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRole(role: string): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

export function useRequireRole(role: string, redirectTo = '/dashboard') {
  const { status, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !hasRole(role)) {
      router.replace(redirectTo);
    }
  }, [status, hasRole, role, redirectTo, router]);
}
