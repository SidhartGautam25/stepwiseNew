'use client';

import React from 'react';
import { useWorkshops } from '../../hooks/use-workshops';
import { WorkshopCard } from '../../components/workshop/WorkshopCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/Button';

export default function WorkshopsPage() {
  const { workshops, isLoading, isError, error, refetch } = useWorkshops();

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Guided Workshops
        </h1>
        <p className="text-slate-400 text-sm">
          Hands-on systems engineering builds. Work locally in your favorite editor,
          verify against official test suites via GitHub Actions.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4"
            >
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-6 rounded-2xl bg-red-950/40 border border-red-800 text-center space-y-3">
          <p className="text-sm text-red-300">
            Failed to load workshops: {error?.message || 'Network error'}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Workshop Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </div>
  );
}
