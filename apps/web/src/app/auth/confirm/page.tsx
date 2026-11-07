'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirm as confirmAuth, ApiError } from '@/utils/auth/client';
import { validateRedirectTarget } from '@/utils/auth/routes';
import { NeoButton } from '@/components/ui/NeoButton';

function ConfirmHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get('token_hash') || '';
  const type = searchParams.get('type') || 'signup';
  const rawNext = searchParams.get('next');
  const targetNext = validateRedirectTarget(rawNext, '/dashboard');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;

    if (!tokenHash) {
      setStatus('error');
      setErrorMessage('Missing confirmation token.');
      return;
    }

    async function runConfirm() {
      try {
        await confirmAuth({ token_hash: tokenHash, type });
        setStatus('success');
        setTimeout(() => {
          router.replace(targetNext);
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        if (err instanceof ApiError) {
          setErrorMessage(err.message || 'Verification token has expired or is invalid.');
        } else {
          setErrorMessage('Email verification failed. Please try again.');
        }
      }
    }

    runConfirm();
  }, [tokenHash, type, targetNext, router]);

  return (
    <div className="w-full max-w-md mx-auto bg-white border-2 border-black p-8 shadow-[4px_4px_0px_#000] text-center space-y-4">
      {status === 'verifying' && (
        <>
          <div className="w-10 h-10 border-4 border-black border-t-[#FFDE59] rounded-full animate-spin mx-auto" />
          <h2 className="font-mono font-black text-xl uppercase tracking-tight text-black">
            Verifying Token
          </h2>
          <p className="font-mono text-sm text-zinc-600">
            Confirming your credentials with the gateway...
          </p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-12 h-12 bg-[#4ADE80] border-2 border-black flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <h2 className="font-mono font-black text-xl uppercase tracking-tight text-black">
            Email Confirmed
          </h2>
          <p className="font-mono text-sm text-zinc-700">
            Your account has been verified. Redirecting you to Handrail...
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-12 h-12 bg-red-100 border-2 border-red-600 flex items-center justify-center mx-auto text-2xl text-red-600">
            ✕
          </div>
          <h2 className="font-mono font-black text-xl uppercase tracking-tight text-black">
            Confirmation Failed
          </h2>
          <p className="font-mono text-xs text-red-700 bg-red-50 p-3 border-2 border-red-200">
            {errorMessage}
          </p>
          <div className="pt-2">
            <Link href="/login">
              <NeoButton variant="yellow" size="md" className="w-full justify-center">
                Return to Sign In
              </NeoButton>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md mx-auto bg-white border-2 border-black p-8 shadow-[4px_4px_0px_#000] text-center font-mono text-sm">
            Verifying confirmation...
          </div>
        }
      >
        <ConfirmHandler />
      </Suspense>
    </div>
  );
}
