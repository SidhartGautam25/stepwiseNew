import React from 'react';
import Link from 'next/link';
import { NeoButton } from '../../ui/NeoButton';
import type { SessionUser } from '@/utils/auth/client';

export interface NavActionsProps {
  user?: SessionUser | null;
  isLoading?: boolean;
  isAuthenticated: boolean;
  onLogin: () => void;
  onGetStarted: () => void;
  className?: string;
}

export function NavActions({
  user,
  isLoading = false,
  isAuthenticated,
  onLogin,
  onGetStarted,
  className = '',
}: NavActionsProps) {
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-20 h-8 bg-zinc-200 border-2 border-black animate-pulse" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const initials = (user.displayName || user.email)
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#FFDE59]/20 transition-all"
        >
          <div className="w-6 h-6 bg-[#FFDE59] border border-black flex items-center justify-center font-mono text-xs font-black">
            {initials}
          </div>
          <span className="font-mono text-xs font-bold text-black hidden sm:inline truncate max-w-[120px]">
            {user.displayName || user.email.split('@')[0]}
          </span>
        </Link>

        <Link href="/settings">
          <NeoButton variant="white" size="sm">
            Settings
          </NeoButton>
        </Link>

        <NeoButton variant="white" size="sm" onClick={onLogin}>
          Sign out
        </NeoButton>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <NeoButton variant="white" size="sm" onClick={onLogin}>
        Log in
      </NeoButton>
      <NeoButton variant="yellow" size="sm" onClick={onGetStarted}>
        Get started
      </NeoButton>
    </div>
  );
}
