import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/utils/auth/server';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/config/query-keys';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?next=/dashboard');
  }

  // Pre-seed the QueryClient with verified server session for instant client hydration
  const queryClient = new QueryClient();
  queryClient.setQueryData(QUERY_KEYS.auth.session, session);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="min-h-screen bg-[#F7F4EE] flex flex-col justify-between">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
          {children}
        </main>
        <Footer />
      </div>
    </HydrationBoundary>
  );
}
