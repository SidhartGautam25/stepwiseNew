'use client';

import React, { useState } from 'react';
import { PRODUCT_NAME } from '@app/contracts';
import { useAuth } from '../context/auth-context';
import { useUIStore, ContentLevel } from '../stores/ui-store';

export function Navbar() {
  const { user, signOut, signInWithEmail, signInWithGitHub } = useAuth();
  const { globalLevel, setGlobalLevel } = useUIStore();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');

  const levels: ContentLevel[] = ['beginner', 'intermediate', 'expert'];

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      signInWithEmail(email);
      setShowEmailInput(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-md bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            H
          </div>
          <span className="font-bold text-lg tracking-tight text-white">{PRODUCT_NAME}</span>
        </div>
        <nav className="hidden md:flex space-x-4 text-sm text-slate-400">
          <a href="/workshops" className="hover:text-white transition-colors">
            Workshops
          </a>
          <a href="/docs" className="hover:text-white transition-colors">
            Docs
          </a>
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        {/* Global Level Switcher */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
          {levels.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setGlobalLevel(lvl)}
              className={`px-2.5 py-1 rounded capitalize transition-all ${
                globalLevel === lvl
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Auth Buttons */}
        {user ? (
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 hidden sm:inline">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 text-slate-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            {showEmailInput ? (
              <form onSubmit={handleEmailSubmit} className="flex items-center space-x-1">
                <input
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded font-medium"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailInput(false)}
                  className="text-xs text-slate-500 hover:text-slate-400 px-1"
                >
                  ✕
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  Email Login
                </button>
                <button
                  onClick={() => signInWithGitHub()}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                >
                  GitHub Login
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
