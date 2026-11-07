'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { executeSingleFlightRefresh } from '@/utils/auth/client';
import { validateRedirectTarget } from '@/utils/auth/routes';

const LOOP_GUARD_KEY = 'hr_refresh_loop_guard';
const LOOP_THRESHOLD_MS = 10000; // 10 seconds

function RefreshHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const targetNext = validateRedirectTarget(rawNext, '/dashboard');

  const [statusMessage, setStatusMessage] = useState('Restoring your session...');
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in React 19 / StrictMode
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    async function attemptRefresh() {
      // 1. Check loop guard in sessionStorage
      try {
        const lastAttempt = sessionStorage.getItem(LOOP_GUARD_KEY);
        if (lastAttempt) {
          const elapsed = Date.now() - parseInt(lastAttempt, 10);
          if (elapsed < LOOP_THRESHOLD_MS) {
            // Potential refresh loop detected -> break out to login
            sessionStorage.removeItem(LOOP_GUARD_KEY);
            router.replace(`/login?next=${encodeURIComponent(targetNext)}&reason=expired`);
            return;
          }
        }
      } catch {
        // sessionStorage restricted
      }

      // 2. Call single-flight refresh
      const success = await executeSingleFlightRefresh();

      if (success) {
        try {
          // Set timestamp to prevent loops if target immediately redirects back
          sessionStorage.setItem(LOOP_GUARD_KEY, Date.now().toString());
        } catch {
          // Ignored
        }
        setStatusMessage('Session restored. Redirecting...');
        router.replace(targetNext);
      } else {
        setStatusMessage('Session expired. Redirecting to login...');
        router.replace(`/login?next=${encodeURIComponent(targetNext)}&reason=expired`);
      }
    }

    attemptRefresh();
  }, [router, targetNext]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-4">
      <div className="w-full max-w-md bg-white border-2 border-black p-8 shadow-[4px_4px_0px_0px_#000000] text-center space-y-4">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-black border-t-[#FFE500] rounded-full" />
        <h2 className="text-xl font-bold font-mono tracking-tight text-black">
          Handrail Authentication
        </h2>
        <p className="text-sm font-mono text-zinc-600">{statusMessage}</p>
      </div>
    </div>
  );
}

export default function AuthRefreshPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-4">
          <div className="w-full max-w-md bg-white border-2 border-black p-8 shadow-[4px_4px_0px_0px_#000000] text-center space-y-4">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-black border-t-[#FFE500] rounded-full" />
            <h2 className="text-xl font-bold font-mono tracking-tight text-black">
              Handrail Authentication
            </h2>
            <p className="text-sm font-mono text-zinc-600">Restoring your session...</p>
          </div>
        </div>
      }
    >
      <RefreshHandler />
    </Suspense>
  );
}
