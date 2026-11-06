import React from 'react';
import Link from 'next/link';
import { NeoCard } from '../ui/NeoCard';
import { NeoBadge } from '../ui/NeoBadge';
import { NeoButton } from '../ui/NeoButton';
import type { WorkshopSummaryDto } from '@app/contracts';

interface WorkshopCardProps {
  workshop: WorkshopSummaryDto;
}

// Assign unique header accent colors per workshop matching homepage theme
function getWorkshopHeaderColor(slug: string): string {
  if (slug.includes('redis')) return 'bg-theme-pink';
  if (slug.includes('react')) return 'bg-theme-blue';
  if (slug.includes('git')) return 'bg-theme-yellow';
  if (slug.includes('npm')) return 'bg-theme-green';
  return 'bg-theme-yellow';
}

export function WorkshopCard({ workshop }: WorkshopCardProps) {
  const headerColor = getWorkshopHeaderColor(workshop.slug);

  return (
    <NeoCard
      shadow="xl"
      className="group flex flex-col justify-between overflow-hidden hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform duration-100"
    >
      <div>
        {/* Neo-brutalist Colored Header Bar */}
        <div
          className={`${headerColor} border-b-2 border-black px-4 py-2.5 flex items-center justify-between`}
        >
          <NeoBadge variant="white" className="text-xs font-bold uppercase py-0.5 px-2">
            {workshop.difficulty}
          </NeoBadge>
          <span className="text-xs font-mono font-bold text-black tracking-tight">
            {workshop.totalSteps} steps • {workshop.estimatedTime}
          </span>
        </div>

        {/* Card Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <Link href={`/workshops/${workshop.slug}`}>
            <h3 className="text-xl font-extrabold text-black group-hover:underline decoration-2 underline-offset-4 tracking-tight transition-all">
              {workshop.title}
            </h3>
          </Link>
          <p className="text-sm text-theme-muted leading-relaxed line-clamp-3">
            {workshop.summary}
          </p>

          <div className="pt-2">
            <div className="text-[11px] font-mono font-bold text-black uppercase tracking-wider mb-2">
              Available Starters:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {workshop.languages.map((lang) => (
                <NeoBadge
                  key={lang}
                  variant="neutral"
                  className="font-mono text-xs font-bold uppercase py-0.5 px-2"
                >
                  {lang}
                </NeoBadge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-5 sm:p-6 pt-0">
        <Link href={`/workshops/${workshop.slug}`} className="block w-full">
          <NeoButton variant="yellow" size="md" className="w-full">
            Explore Workshop →
          </NeoButton>
        </Link>
      </div>
    </NeoCard>
  );
}

