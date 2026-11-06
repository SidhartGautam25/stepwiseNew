import React from 'react';
import { NeoButton } from '../../ui/NeoButton';

export interface HeroActionsProps {
  onBrowse: () => void;
  onReviews: () => void;
  className?: string;
}

export function HeroActions({
  onBrowse,
  onReviews,
  className = '',
}: HeroActionsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 pt-1 ${className}`}>
      <NeoButton variant="yellow" size="md" onClick={onBrowse}>
        Browse workshops
      </NeoButton>
      <NeoButton variant="white" size="md" onClick={onReviews}>
        Read reviews
      </NeoButton>
    </div>
  );
}
