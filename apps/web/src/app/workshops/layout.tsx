import React from 'react';
import { Navbar } from '../../components/layout/Navbar/Navbar';
import { Footer } from '../../components/layout/Footer';

export default function WorkshopsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-theme-bg text-theme-fg flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
