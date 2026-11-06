import React from 'react';
import { NeoBadge } from '../../ui/NeoBadge';

export interface HeroBannerProps {
  text: string;
  className?: string;
}

export function HeroBanner({ text, className = '' }: HeroBannerProps) {
  return (
    <div className={`mb-1 sm:mb-2 ${className}`}>
      <NeoBadge
        variant="pink"
        hasShadow
        className="font-mono text-xs font-bold px-2.5 py-0.5 tracking-tight"
      >
        {text}
      </NeoBadge>
    </div>
  );
}
