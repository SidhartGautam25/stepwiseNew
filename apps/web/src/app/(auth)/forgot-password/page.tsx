'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { forgotPassword, ApiError } from '@/utils/auth/client';
import { NeoButton } from '@/components/ui/NeoButton';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await forgotPassword({ email });
      setIsSubmitted(true);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setErrorMessage('Too many requests. Please wait a few minutes before trying again.');
      } else {
        // We still show success or safe message to prevent email enumeration
        setIsSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000] text-center space-y-4">
        <div className="w-12 h-12 bg-[#93C5FD] border-2 border-black flex items-center justify-center mx-auto text-2xl">
          📬
        </div>
        <h1 className="font-mono font-black text-2xl text-black uppercase tracking-tight">
          Reset Link Sent
        </h1>
        <p className="font-mono text-sm text-zinc-700">
          If an account exists for <span className="font-bold text-black">{email}</span>, we&apos;ve sent instructions to reset your password.
        </p>
        <div className="pt-4 border-t-2 border-black">
          <Link href="/login">
            <NeoButton variant="yellow" size="md" className="w-full justify-center">
              Return to Sign In
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
          Reset Password
        </h1>
        <p className="font-mono text-xs text-zinc-600 mt-1">
          Enter your email and we&apos;ll send you a recovery link.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-xs font-mono font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
            Account Email
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

        <NeoButton
          type="submit"
          variant="yellow"
          size="md"
          className="w-full justify-center mt-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
        </NeoButton>
      </form>

      <div className="mt-6 pt-4 border-t-2 border-black text-center font-mono text-xs text-zinc-600">
        Remember your password?{' '}
        <Link href="/login" className="font-bold text-black underline hover:bg-[#FFDE59]">
          Sign in here
        </Link>
      </div>
    </div>
  );
}
