'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { NeoCard } from '../ui/NeoCard';
import { NeoBadge } from '../ui/NeoBadge';
import type { ChapterSummaryDto } from '@app/contracts';

interface StepsRailProps {
  workshopSlug: string;
  chapters: ChapterSummaryDto[];
  activeStepSlug?: string;
  stepStatuses?: Record<string, 'LOCKED' | 'AVAILABLE' | 'COMPLETED'>;
}

export function StepsRail({
  workshopSlug,
  chapters,
  activeStepSlug,
  stepStatuses = {},
}: StepsRailProps) {
  return (
    <aside className="w-full lg:w-72 shrink-0">
      <NeoCard shadow="md" className="p-4 space-y-5">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
            Steps Rail
          </h2>
          <NeoBadge variant="yellow" className="text-[10px] font-bold">
            Sequential
          </NeoBadge>
        </div>

        <div className="space-y-5">
          {chapters.map((chapter) => (
            <div key={chapter.id} className="space-y-2">
              <div className="px-1">
                <div className="text-[10px] font-mono font-bold text-theme-muted uppercase tracking-wider">
                  Chapter {chapter.orderIndex}
                </div>
                <div className="text-xs font-extrabold text-black">
                  {chapter.title}
                </div>
              </div>

              <div className="space-y-1.5">
                {chapter.steps.map((step) => {
                  const isActive = step.slug === activeStepSlug;
                  const status =
                    stepStatuses[step.slug] || (step.globalOrder === 1 ? 'AVAILABLE' : 'LOCKED');

                  return (
                    <Link
                      key={step.id}
                      href={`/workshops/${workshopSlug}/chapters/${chapter.slug}/steps/${step.slug}`}
                      className={clsx(
                        'group flex items-center justify-between p-2 rounded-[2px] text-xs font-medium transition-all select-none',
                        isActive
                          ? 'bg-theme-yellow text-black border-2 border-black font-bold shadow-hard-sm'
                          : 'text-black bg-white hover:bg-stone-100 border-2 border-transparent hover:border-black',
                      )}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className={clsx(
                            'flex items-center justify-center h-5 w-5 rounded-[2px] text-[10px] font-mono font-bold shrink-0 border border-black',
                            isActive
                              ? 'bg-black text-white'
                              : 'bg-stone-200 text-black',
                          )}
                        >
                          {step.globalOrder}
                        </span>
                        <span className="truncate">{step.title}</span>
                      </div>

                      <span className="shrink-0 ml-2">
                        {status === 'COMPLETED' ? (
                          <span className="inline-block bg-theme-green text-black border border-black font-mono font-bold text-[10px] px-1 rounded-[2px]">
                            ✓
                          </span>
                        ) : status === 'AVAILABLE' ? (
                          <span className="h-2 w-2 rounded-full bg-theme-blue border border-black inline-block" />
                        ) : (
                          <span className="text-[10px] font-mono text-stone-400">🔒</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </NeoCard>
    </aside>
  );
}

