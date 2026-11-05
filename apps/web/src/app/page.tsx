'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import { useLevelPreference } from '../hooks/use-level-preference';
import { fetchMe } from '../lib/api-client';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { LevelSwitcher } from '../components/workshop/LevelSwitcher';
import type { UserDto } from '@app/contracts';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'ok' | 'down' | 'checking';
  uptime?: number;
}

export default function HomePage() {
  const { user, token, setDevToken } = useAuth();
  const { level, metadata } = useLevelPreference();
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
    const response = await fetch('/api/dev-token').catch(() => null);
    if (response && response.ok) {
      const { token: devToken, user: devUser } = await response.json();
      setDevToken(devToken, devUser);
    } else {
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
    <div className="space-y-8 py-2">
      {/* Hero */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl space-y-4">
          <Badge variant="emerald">Milestone 2 — Content & Learning UI</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Guided learn-by-building platform for engineers.
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Work locally in your favorite editor. Push to GitHub for official server-computed
            verdicts. Switch depth levels live between Beginner, Intermediate, and Expert.
          </p>

          <div className="pt-2 flex flex-wrap gap-4 items-center">
            <Link href="/workshops">
              <Button variant="primary" size="md">
                Browse Workshops →
              </Button>
            </Link>
            <Button variant="outline" size="md" onClick={checkHealth}>
              Probe Microservices Health
            </Button>
          </div>
        </div>
      </section>

      {/* Level Preference Card */}
      <Card className="bg-slate-900/50">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg">Adaptive Content Depth</CardTitle>
            <p className="text-xs text-slate-400">
              Persisted in client storage and applied live across all steps and theory.
            </p>
          </div>
          <LevelSwitcher showDescription />
        </CardHeader>
      </Card>

      {/* Grid: Auth & Protected Endpoint Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth & Session State */}
        <Card className="bg-slate-900/50">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base">Supabase Authentication</CardTitle>
            <Badge variant={user ? 'emerald' : 'default'}>
              {user ? 'Authenticated' : 'Anonymous'}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Sessions are managed in React Context and forwarded as Bearer JWT tokens to the API Gateway.
            </p>

            <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
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

            {!user && (
              <Button size="sm" variant="secondary" onClick={handleSimulateDevToken}>
                Simulate Dev JWT Session
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Protected GET /v1/me Verification */}
        <Card className="bg-slate-900/50">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-base">Protected Gateway Endpoint</CardTitle>
            <span className="text-xs font-mono text-emerald-400">GET /v1/me</span>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-xs text-slate-400">
              Validates Supabase JWT at Gateway via JWKS / HS256 fallback, rejects forged headers, returns verified profile.
            </p>

            <Button
              variant="emerald"
              size="md"
              className="w-full"
              isLoading={profileLoading}
              onClick={handleTestProtectedMe}
            >
              Call Protected GET /v1/me
            </Button>

            {profileError && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-xs text-red-300 font-mono">
                {profileError}
              </div>
            )}

            {profile && (
              <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 border border-slate-800">
                <div className="text-emerald-400 font-semibold mb-1">✓ Server Verified Response:</div>
                <div>id: {profile.id}</div>
                <div>email: {profile.email}</div>
                <div>role: {profile.role}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Services Matrix */}
      <Card className="bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base">Microservices Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
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
        </CardContent>
      </Card>
    </div>
  );
}
