'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SITE_CONFIG } from '../../config/site';
import { useAuth } from '../../context/auth-context';
import { Button } from '../ui/Button';
import { LevelSwitcher } from '../workshop/LevelSwitcher';

export function Navbar() {
  const { user, signOut, signInWithEmail, signInWithGitHub } = useAuth();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      signInWithEmail(email);
      setShowEmailInput(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              H
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              {SITE_CONFIG.name}
            </span>
          </Link>

          <nav className="hidden md:flex space-x-6 text-sm text-slate-400">
            <Link
              href="/workshops"
              className="hover:text-white font-medium transition-colors"
            >
              Workshops
            </Link>
            <Link
              href="/"
              className="hover:text-white font-medium transition-colors"
            >
              System Dashboard
            </Link>
          </nav>
        </div>

        {/* Level Switcher & Auth */}
        <div className="flex items-center space-x-4">
          <LevelSwitcher />

          {user ? (
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-slate-400 hidden sm:inline truncate max-w-[150px]">
                {user.email}
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {showEmailInput ? (
                <form
                  onSubmit={handleEmailSubmit}
                  className="flex items-center space-x-1.5"
                >
                  <input
                    type="email"
                    placeholder="Enter email..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-md bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <Button size="sm" variant="emerald" type="submit">
                    Go
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setShowEmailInput(false)}
                  >
                    ✕
                  </Button>
                </form>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowEmailInput(true)}
                  >
                    Email Login
                  </Button>
                  <Button
                    size="sm"
                    variant="emerald"
                    onClick={() => signInWithGitHub()}
                  >
                    GitHub Login
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

