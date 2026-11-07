'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { validateRedirectTarget } from '@/utils/auth/routes';
import { ApiError } from '@/utils/auth/client';
import { NeoButton } from '@/components/ui/NeoButton';

function SignupForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const targetNext = validateRedirectTarget(rawNext, '/dashboard');
  const oauthError = searchParams.get('error');
  const initialError = oauthError
    ? oauthError === 'invalid_pkce_session'
      ? 'OAuth session expired or was invalid. Please try signing in again.'
      : oauthError === 'github_oauth_not_configured'
      ? 'GitHub OAuth is not configured yet. Set GITHUB_OAUTH_ENABLED=true, GITHUB_CLIENT_ID, and GITHUB_CLIENT_SECRET in .env, or sign up with email.'
      : 'GitHub sign-in could not be completed. Please try again or use email.'
    : null;

  const { signup, startGitHubOAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({ email, password });
      setIsSuccess(true);
    } catch (err: any) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'USER_ALREADY_EXISTS':
            setErrorMessage('An account with this email already exists.');
            break;
          case 'WEAK_PASSWORD':
            setErrorMessage('Password is too weak. Please use letters, numbers, and symbols.');
            break;
          case 'RATE_LIMITED':
            setErrorMessage('Too many signup requests. Please try again shortly.');
            break;
          default:
            setErrorMessage(err.message || 'Signup failed. Please try again.');
        }
      } else {
        setErrorMessage(err?.message || 'Unable to create account. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGitHubClick = () => {
    startGitHubOAuth(targetNext);
  };

  if (isSuccess) {
    return (
      <div className="w-full bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000] text-center space-y-4">
        <div className="w-12 h-12 bg-[#FFDE59] border-2 border-black flex items-center justify-center mx-auto text-2xl">
          ✉️
        </div>
        <h1 className="font-mono font-black text-2xl text-black uppercase tracking-tight">
          Check Your Email
        </h1>
        <p className="font-mono text-sm text-zinc-700">
          We&apos;ve sent a verification link to{' '}
          <span className="font-bold text-black">{email}</span>. Click the link in that email to confirm your account and start building.
        </p>
        <div className="pt-4 border-t-2 border-black">
          <Link href="/login">
            <NeoButton variant="yellow" size="md" className="w-full justify-center">
              Back to Sign In
            </NeoButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000]">
      <div className="mb-6">
        <h1 className="font-mono font-black text-2xl text-black uppercase tracking-tight">
          Create Account
        </h1>
        <p className="font-mono text-xs text-zinc-600 mt-1">
          Join Handrail to build production-grade software locally.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-xs font-mono font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {/* GitHub OAuth Button */}
      <button
        type="button"
        onClick={handleGitHubClick}
        className="w-full mb-6 flex items-center justify-center gap-3 py-2.5 px-4 bg-black text-white border-2 border-black font-mono text-sm font-bold shadow-[2px_2px_0px_#000] hover:bg-zinc-800 hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
      >
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
        Sign up with GitHub
      </button>

      <div className="relative flex items-center justify-center mb-6">
        <div className="w-full border-t-2 border-black" />
        <span className="absolute bg-white px-3 font-mono text-xs text-zinc-500 uppercase">
          or register with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
          />
        </div>

        <div>
          <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
            Password (min. 8 characters)
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
          />
        </div>

        <div>
          <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
          />
        </div>

        <NeoButton
          type="submit"
          variant="yellow"
          size="md"
          className="w-full justify-center mt-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </NeoButton>
      </form>

      <div className="mt-6 pt-4 border-t-2 border-black text-center font-mono text-xs text-zinc-600">
        Already have an account?{' '}
        <Link
          href={`/login${rawNext ? `?next=${encodeURIComponent(targetNext)}` : ''}`}
          className="font-bold text-black underline hover:bg-[#FFDE59]"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full bg-white border-2 border-black p-8 shadow-[4px_4px_0px_#000] text-center font-mono text-sm">
          Loading sign up...
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
