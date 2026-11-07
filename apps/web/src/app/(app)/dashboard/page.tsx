'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { useProfile, useActivity } from '@/hooks/use-profile';
import { NeoButton } from '@/components/ui/NeoButton';
import { NeoBadge } from '@/components/ui/NeoBadge';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: profile, isLoading: isProfileLoading } = useProfile();
  const { data: activities, isLoading: isActivityLoading } = useActivity();

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-mono font-black text-2xl sm:text-3xl text-black uppercase tracking-tight">
              Dashboard
            </h1>
            {user?.roles?.map((role) => (
              <NeoBadge key={role} variant={role === 'admin' ? 'pink' : 'yellow'}>
                {role}
              </NeoBadge>
            ))}
          </div>
          <p className="font-mono text-sm text-zinc-600">
            Welcome back,{' '}
            <span className="font-bold text-black">
              {profile?.displayName || user?.displayName || user?.email}
            </span>
            . Ready to build your next service?
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/workshops">
            <NeoButton variant="yellow" size="md">
              Browse Workshops →
            </NeoButton>
          </Link>
          <Link href="/settings">
            <NeoButton variant="white" size="md">
              Settings
            </NeoButton>
          </Link>
        </div>
      </div>

      {/* Grid: Profile Snapshot & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white border-2 border-black p-6 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="border-b-2 border-black pb-3">
            <h2 className="font-mono font-bold text-base uppercase text-black">
              Learner Profile
            </h2>
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div>
              <span className="text-zinc-500 uppercase">Email: </span>
              <span className="font-bold text-black">{user?.email}</span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase">User ID: </span>
              <span className="font-mono text-[11px] text-zinc-700">{user?.id}</span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase">Default Level: </span>
              <span className="font-bold uppercase text-black">
                {profile?.defaultLevel || 'beginner'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase">Language: </span>
              <span className="font-bold uppercase text-black">
                {profile?.defaultLanguage || 'typescript'}
              </span>
            </div>
          </div>
        </div>

        {/* Learning Track Card */}
        <div className="bg-white border-2 border-black p-6 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="border-b-2 border-black pb-3">
            <h2 className="font-mono font-bold text-base uppercase text-black">
              Active Track
            </h2>
          </div>
          <div className="space-y-3 font-mono text-xs">
            <p className="text-zinc-700">
              Pick a workshop to build a verified distributed system locally with GitHub Actions verification.
            </p>
            <div className="pt-2">
              <Link href="/workshops" className="text-black font-bold underline hover:bg-[#FFDE59]">
                View 4 Available Workshops &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Security / Session Card */}
        <div className="bg-white border-2 border-black p-6 shadow-[3px_3px_0px_#000] space-y-4">
          <div className="border-b-2 border-black pb-3">
            <h2 className="font-mono font-bold text-base uppercase text-black">
              Session & Security
            </h2>
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full border border-black inline-block" />
              <span className="font-bold text-black">HttpOnly Cookie Active</span>
            </div>
            <p className="text-zinc-600">
              Authenticated via gateway CSRF & Jose JWT verification.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000] space-y-4">
        <div className="border-b-2 border-black pb-3 flex items-center justify-between">
          <h2 className="font-mono font-bold text-lg uppercase text-black">
            Recent Activity
          </h2>
          <span className="font-mono text-xs text-zinc-500">Live event log</span>
        </div>

        {isActivityLoading ? (
          <div className="py-8 text-center font-mono text-sm text-zinc-500">
            Loading activity log...
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="divide-y-2 divide-black/10 font-mono text-xs">
            {activities.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-black uppercase">{act.action}</span>
                  {act.metadata && Object.keys(act.metadata).length > 0 && (
                    <span className="text-zinc-600 ml-2">
                      ({JSON.stringify(act.metadata)})
                    </span>
                  )}
                </div>
                <span className="text-zinc-400 text-[11px]">
                  {new Date(act.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center font-mono text-sm text-zinc-500">
            No recent activity recorded yet. Start a workshop to begin logging progress!
          </div>
        )}
      </div>
    </div>
  );
}
