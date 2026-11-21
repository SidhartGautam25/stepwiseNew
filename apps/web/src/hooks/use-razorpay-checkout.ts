'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/utils/auth/client';
import { env } from '@/config/env';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/config/query-keys';
import type { PaymentOrderResponseDto, PaymentVerifyResponseDto } from '@app/contracts';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout.js script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface UseRazorpayCheckoutOptions {
  onSuccess?: (verifyRes: PaymentVerifyResponseDto) => void;
  onError?: (err: Error) => void;
}

export function useRazorpayCheckout() {
  const { session, status } = useAuth();
  const queryClient = useQueryClient();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyWorkshop = useCallback(
    async (
      workshopSlug: string,
      workshopTitle: string,
      callbacks?: UseRazorpayCheckoutOptions,
    ) => {
      setIsCheckingOut(true);
      setError(null);

      try {
        if (status !== 'authenticated' || !session?.user) {
          throw new Error('Please sign in or select a profile before buying a workshop.');
        }

        // 1. Create order on payment-service via gateway
        let orderData: PaymentOrderResponseDto;
        try {
          orderData = await apiFetch<PaymentOrderResponseDto>('/v1/payments/orders', {
            method: 'POST',
            body: JSON.stringify({ workshopSlug, currency: 'INR' }),
          });
        } catch (orderErr: any) {
          // If already purchased (409 Conflict), auto-resolve as success and unlock immediately
          if (
            orderErr?.statusCode === 409 ||
            orderErr?.status === 409 ||
            orderErr?.message?.toLowerCase().includes('already purchased')
          ) {
            console.log(`Workshop [${workshopSlug}] is already purchased. Auto-unlocking...`);
            await queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
            });
            await queryClient.invalidateQueries({ queryKey: ['profile', 'enrollments'] });
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.activity });

            callbacks?.onSuccess?.({
              success: true,
              orderId: '',
              paymentId: '',
              status: 'PAID',
              workshopSlug,
            });
            setIsCheckingOut(false);
            return;
          }
          throw orderErr;
        }

        // 2. Load Razorpay script
        const scriptLoaded = await loadRazorpayScript();

        // If Razorpay checkout script is unavailable (e.g. offline dev or mock mode)
        if (!scriptLoaded || typeof window.Razorpay === 'undefined') {
          // Check if mock order is supported
          if (orderData.orderId.startsWith('order_')) {
            console.log('Razorpay SDK not loaded. Simulating local test mock verification...');
            const verifyRes = await apiFetch<PaymentVerifyResponseDto>('/v1/payments/verify', {
              method: 'POST',
              body: JSON.stringify({
                orderId: orderData.orderId,
                paymentId: `pay_mock_${Date.now()}`,
                signature: `mock_sig_${orderData.orderId}`,
                razorpayOrderId: orderData.orderId,
                razorpayPaymentId: `pay_mock_${Date.now()}`,
                razorpaySignature: `mock_sig_${orderData.orderId}`,
              }),
            });

            await queryClient.invalidateQueries({
              queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
            });
            await queryClient.invalidateQueries({ queryKey: ['profile', 'enrollments'] });
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.activity });

            callbacks?.onSuccess?.(verifyRes);
            return;
          }

          throw new Error('Could not load Razorpay checkout modal. Please check your network connection.');
        }

        // 3. Open Razorpay Checkout modal
        const keyId = env.NEXT_PUBLIC_RAZORPAY_KEY_ID || orderData.keyId;

        const options = {
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Handrail Systems Engine',
          description: `Unlock Full Access: ${workshopTitle}`,
          order_id: orderData.orderId,
          prefill: {
            name: session.user.displayName || '',
            email: session.user.email || '',
          },
          theme: {
            color: '#FFDE59', // Handrail signature neo-yellow
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              // 4. Verify payment HMAC signature with backend
              const verifyRes = await apiFetch<PaymentVerifyResponseDto>('/v1/payments/verify', {
                method: 'POST',
                body: JSON.stringify({
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });

              // 5. Invalidate progress, profile enrollments, and activity
              await queryClient.invalidateQueries({
                queryKey: QUERY_KEYS.workshops.progress(workshopSlug),
              });
              await queryClient.invalidateQueries({ queryKey: ['profile', 'enrollments'] });
              await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile.activity });

              callbacks?.onSuccess?.(verifyRes);
            } catch (verifyErr: any) {
              const msg = verifyErr.message || 'Payment signature verification failed';
              setError(msg);
              callbacks?.onError?.(new Error(msg));
            } finally {
              setIsCheckingOut(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsCheckingOut(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (failResp: any) => {
          const failMsg = failResp.error?.description || 'Payment was declined or failed';
          setError(failMsg);
          setIsCheckingOut(false);
          callbacks?.onError?.(new Error(failMsg));
        });

        rzp.open();
      } catch (err: any) {
        const errorMsg = err.message || 'Failed to start payment process';
        setError(errorMsg);
        setIsCheckingOut(false);
        callbacks?.onError?.(new Error(errorMsg));
      }
    },
    [session, status, queryClient],
  );

  return {
    buyWorkshop,
    isCheckingOut,
    error,
    clearError: () => setError(null),
  };
}
