import React from 'react';
import type { HeroFeaturePill } from '../../../hooks/use-hero';
import { NeoBadge } from '../../ui/NeoBadge';

export interface HeroFeaturePillsProps {
  pills: HeroFeaturePill[];
  className?: string;
}

export function HeroFeaturePills({
  pills,
  className = '',
}: HeroFeaturePillsProps) {
  return (
    <div className={`space-y-1.5 pt-1 ${className}`}>
      {/* First row of feature pills */}
      <div className="flex flex-wrap items-center gap-2">
        {pills.slice(0, 2).map((pill) => (
          <NeoBadge key={pill.id} variant="white" className="py-0.5 px-2 text-[11px]">
            {pill.label}
          </NeoBadge>
        ))}
      </div>

      {/* Second row */}
      {pills.length > 2 && (
        <div className="flex flex-wrap items-center gap-2">
          {pills.slice(2).map((pill) => (
            <NeoBadge key={pill.id} variant="white" className="py-0.5 px-2 text-[11px]">
              {pill.label}
            </NeoBadge>
          ))}
        </div>
      )}
    </div>
  );
}
