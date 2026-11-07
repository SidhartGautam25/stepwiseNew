import React from 'react';
import Link from 'next/link';
import { HandrailLogo } from '@/components/ui/HandrailLogo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-4">
        <HandrailLogo href="/" />
        <Link
          href="/workshops"
          className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-700 hover:text-black border-2 border-black bg-white px-3 py-1.5 shadow-[2px_2px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          Explore Workshops
        </Link>
      </header>

      {/* Centered Auth Card Area */}
      <main className="w-full max-w-md mx-auto my-auto py-8">
        {children}
      </main>

      {/* Simple Footer */}
      <footer className="w-full max-w-6xl mx-auto py-4 text-center font-mono text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} Handrail Platform. Guided learn-by-building.
      </footer>
    </div>
  );
}
