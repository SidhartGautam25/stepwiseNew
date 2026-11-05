import React from 'react';
import { NeoBadge } from '../../ui/NeoBadge';

export interface HeroCardHeaderProps {
  stepLabel: string;
  chapterLabel: string;
}

export function HeroCardHeader({
  stepLabel,
  chapterLabel,
}: HeroCardHeaderProps) {
  return (
    <div className="bg-theme-blue border-b-2 border-black px-4 py-2.5 flex items-center justify-between">
      <span className="font-mono text-xs font-bold text-black tracking-tight">
        {stepLabel}
      </span>
      <NeoBadge variant="white" className="text-[11px] font-bold py-0.5 px-2">
        {chapterLabel}
      </NeoBadge>
    </div>
  );
}

