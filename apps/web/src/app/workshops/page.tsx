'use client';

import React from 'react';
import { useWorkshops } from '../../hooks/use-workshops';
import { WorkshopCard } from '../../components/workshop/WorkshopCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { NeoButton } from '../../components/ui/NeoButton';
import { NeoBadge } from '../../components/ui/NeoBadge';
import { NeoCard } from '../../components/ui/NeoCard';

export default function WorkshopsPage() {
  const { workshops, isLoading, isError, error, refetch } = useWorkshops();

  return (
    <div className="space-y-10 py-4 sm:py-6">
      {/* Header Banner & Title */}
      <div className="max-w-3xl space-y-3">
        <div>
          <NeoBadge
            variant="pink"
            hasShadow
            className="font-mono text-xs font-bold px-3 py-1 tracking-tight mb-2"
          >
            HANDRAIL CATALOG • 4 GUIDED WORKSHOPS
          </NeoBadge>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-black">
          Guided Workshops
        </h1>
        <p className="text-base sm:text-lg text-theme-muted leading-relaxed">
          Hands-on systems engineering builds. Work locally in your favorite editor,
          verify against official test suites via GitHub Actions.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <NeoCard key={i} shadow="xl" className="overflow-hidden">
              <div className="bg-theme-blue/30 border-b-2 border-black p-3">
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="p-6 space-y-4">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-10 w-full mt-4" />
              </div>
            </NeoCard>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <NeoCard shadow="xl" className="max-w-xl mx-auto p-8 text-center space-y-4 bg-[#FEE2E2]">
          <div className="font-mono font-bold text-lg text-black">
            Failed to Load Workshops
          </div>
          <p className="text-sm text-theme-muted">
            {error?.message || 'Database or network connection failed'}
          </p>
          <NeoButton variant="yellow" size="md" onClick={() => refetch()}>
            Retry Loading Catalog
          </NeoButton>
        </NeoCard>
      )}

      {/* Workshop Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </div>
  );
}

