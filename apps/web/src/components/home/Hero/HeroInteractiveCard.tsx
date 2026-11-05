'use client';

import React from 'react';
import { useHeroInteractiveCard } from '../../../hooks/use-hero-interactive-card';
import { NeoCard } from '../../ui/NeoCard';
import { HeroCardHeader } from './HeroCardHeader';
import { HeroCardContent } from './HeroCardContent';

export interface HeroInteractiveCardProps {
  className?: string;
}

export function HeroInteractiveCard({
  className = '',
}: HeroInteractiveCardProps) {
  const {
    stepLabel,
    chapterLabel,
    activeLevel,
    setActiveLevel,
    tabs,
    currentExplanation,
    terminalLines,
  } = useHeroInteractiveCard();

  return (
    <div className={`w-full max-w-[420px] lg:max-w-[460px] ${className}`}>
      <NeoCard shadow="xl" className="overflow-hidden">
        <HeroCardHeader
          stepLabel={stepLabel}
          chapterLabel={chapterLabel}
        />
        <HeroCardContent
          tabs={tabs}
          activeLevel={activeLevel}
          onLevelChange={setActiveLevel}
          explanation={currentExplanation}
          terminalLines={terminalLines}
        />
      </NeoCard>
    </div>
  );
}
