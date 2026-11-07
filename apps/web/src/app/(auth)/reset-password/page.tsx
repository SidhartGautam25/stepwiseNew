'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resetPassword, ApiError } from '@/utils/auth/client';
import { NeoButton } from '@/components/ui/NeoButton';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPassword({ password: newPassword });
      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || 'Password reset failed. The link may have expired.');
      } else {
        setErrorMessage('Unable to reset password. Please request a new link.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full bg-white border-2 border-black p-6 sm:p-8 shadow-[4px_4px_0px_#000] text-center space-y-4">
        <div className="w-12 h-12 bg-[#4ADE80] border-2 border-black flex items-center justify-center mx-auto text-2xl">
          ✓
        </div>
        <h1 className="font-mono font-black text-2xl text-black uppercase tracking-tight">
          Password Updated
        </h1>
        <p className="font-mono text-sm text-zinc-700">
          Your password has been changed successfully. Redirecting to sign in...
        </p>
        <div className="pt-4 border-t-2 border-black">
          <Link href="/login">
            <NeoButton variant="yellow" size="md" className="w-full justify-center">
              Sign In Now
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
          New Password
        </h1>
        <p className="font-mono text-xs text-zinc-600 mt-1">
          Enter your new password below.
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
            New Password (min. 8 characters)
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-[#FAF9F5] border-2 border-black font-mono text-sm text-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
          />
        </div>

        <div>
          <label className="block font-mono text-xs font-bold text-black uppercase mb-1">
            Confirm New Password
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
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </NeoButton>
      </form>
    </div>
  );
}
