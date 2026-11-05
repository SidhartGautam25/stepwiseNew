'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Badge } from '../ui/Badge';
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
    <aside className="w-full lg:w-72 shrink-0 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Steps Rail
        </h2>
        <span className="text-[11px] font-mono text-emerald-400">Sequential</span>
      </div>

      <div className="space-y-6">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="space-y-2">
            <div className="px-2">
              <div className="text-[11px] font-mono text-slate-500 uppercase">
                Chapter {chapter.orderIndex}
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {chapter.title}
              </div>
            </div>

            <div className="space-y-1">
              {chapter.steps.map((step) => {
                const isActive = step.slug === activeStepSlug;
                const status = stepStatuses[step.slug] || (step.globalOrder === 1 ? 'AVAILABLE' : 'LOCKED');

                return (
                  <Link
                    key={step.id}
                    href={`/workshops/${workshopSlug}/chapters/${chapter.slug}/steps/${step.slug}`}
                    className={clsx(
                      'group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-all',
                      isActive
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent',
                    )}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span
                        className={clsx(
                          'flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-mono shrink-0',
                          isActive
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400',
                        )}
                      >
                        {step.globalOrder}
                      </span>
                      <span className="truncate">{step.title}</span>
                    </div>

                    <span className="shrink-0 ml-2">
                      {status === 'COMPLETED' ? (
                        <span className="text-emerald-400 font-bold text-xs">✓</span>
                      ) : status === 'AVAILABLE' ? (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">🔒</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
