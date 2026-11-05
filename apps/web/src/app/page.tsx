'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useUIStore } from '../stores/ui-store';
import { fetchMe } from '../lib/api-client';
import type { UserDto } from '@app/contracts';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'ok' | 'down' | 'checking';
  uptime?: number;
}

export default function HomePage() {
  const { user, token, setDevToken } = useAuth();
  const { globalLevel } = useUIStore();
  const [profile, setProfile] = useState<UserDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Gateway', url: 'http://localhost:4000/health', status: 'checking' },
    { name: 'Catalog Service', url: 'http://localhost:4001/health', status: 'checking' },
    { name: 'Starter Service', url: 'http://localhost:4002/health', status: 'checking' },
    { name: 'Verification Service', url: 'http://localhost:4003/health', status: 'checking' },
    { name: 'Progress Service', url: 'http://localhost:4004/health', status: 'checking' },
    { name: 'Realtime Service', url: 'http://localhost:4005/health', status: 'checking' },
  ]);

  const handleTestProtectedMe = async () => {
    if (!token) {
      setProfileError('No active JWT session. Sign in or use Dev Token simulator below.');
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await fetchMe(token);
      setProfile(data);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to fetch /v1/me');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSimulateDevToken = async () => {
    // Generates an HS256 signed test token using the default dev secret
    // Allows local testing of protected /v1/me without requiring external Supabase cloud setup
    const response = await fetch('/api/dev-token').catch(() => null);
    if (response && response.ok) {
      const { token: devToken, user: devUser } = await response.json();
      setDevToken(devToken, devUser);
    } else {
      // Fallback dev mock token
      const mockId = '550e8400-e29b-41d4-a716-446655440000';
      setDevToken('mock-jwt-token', {
        id: mockId,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: 'local-engineer@example.com',
      } as any);
    }
  };

  const checkHealth = async () => {
    const updated = await Promise.all(
      services.map(async (svc) => {
        try {
          const res = await fetch(svc.url, { mode: 'cors' });
          if (res.ok) {
            const data = await res.json();
            return { ...svc, status: 'ok' as const, uptime: data.uptime };
          }
          return { ...svc, status: 'down' as const };
        } catch {
          return { ...svc, status: 'down' as const };
        }
      }),
    );
    setServices(updated);
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl">
          <span className="inline-block px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
            Milestone 1 — Foundation
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Guided learn-by-building platform for engineers.
          </h1>
          <p className="mt-3 text-base text-slate-400">
            Work locally in your favorite editor. Push to GitHub for official server-computed
            verdicts. Real-time feedback streamed directly to your browser.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 items-center">
            <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              Active Content Depth: <span className="font-semibold text-emerald-400 uppercase">{globalLevel}</span>
            </div>
            <button
              onClick={checkHealth}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              Probe Services Health
            </button>
          </div>
        </div>
      </section>

      {/* Grid: Auth & Protected Endpoint Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth & Session State */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center justify-between">
            <span>Supabase Authentication</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full ${
                user ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {user ? 'Authenticated' : 'Anonymous'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Sessions are managed in React Context and forwarded as Bearer JWT tokens to the API Gateway.
          </p>

          <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
            <div>
              <span className="text-slate-500">User ID:</span>{' '}
              <span className="text-emerald-400">{user?.id || 'None'}</span>
            </div>
            <div>
              <span className="text-slate-500">Email:</span>{' '}
              <span className="text-slate-200">{user?.email || 'None'}</span>
            </div>
            <div className="truncate">
              <span className="text-slate-500">JWT Token:</span>{' '}
              <span className="text-slate-400">{token ? `${token.substring(0, 28)}...` : 'None'}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {!user && (
              <button
                onClick={handleSimulateDevToken}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 transition"
              >
                Simulate Dev JWT Session
              </button>
            )}
          </div>
        </div>

        {/* Protected GET /v1/me Verification */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center justify-between">
            <span>Protected Gateway Endpoint</span>
            <span className="text-xs font-mono text-emerald-400">GET /v1/me</span>
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Validates Supabase JWT at Gateway via JWKS / HS256 fallback, rejects forged headers, returns verified profile.
          </p>

          <button
            onClick={handleTestProtectedMe}
            disabled={profileLoading}
            className="w-full mb-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg text-xs transition"
          >
            {profileLoading ? 'Calling /v1/me...' : 'Call Protected GET /v1/me'}
          </button>

          {profileError && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300 font-mono">
              {profileError}
            </div>
          )}

          {profile && (
            <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1.5 border border-slate-800">
              <div className="text-emerald-400 font-semibold mb-1">✓ Server Verified Response:</div>
              <div>id: {profile.id}</div>
              <div>email: {profile.email}</div>
              <div>role: {profile.role}</div>
            </div>
          )}
        </div>
      </div>

      {/* Services Health Status Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Microservices Matrix</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200">{svc.name}</div>
                <div className="text-[10px] font-mono text-slate-500">{svc.url}</div>
              </div>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    svc.status === 'ok'
                      ? 'bg-emerald-500'
                      : svc.status === 'down'
                      ? 'bg-red-500'
                      : 'bg-amber-500 animate-pulse'
                  }`}
                />
                <span className="text-[11px] capitalize text-slate-400">{svc.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

