import React from 'react';
import { HandrailLogo } from '../../ui/HandrailLogo';

export interface FooterBrandProps {
  description: string;
  className?: string;
}

export function FooterBrand({ description, className = '' }: FooterBrandProps) {
  return (
    <div className={`space-y-3 max-w-sm ${className}`}>
      <HandrailLogo textColor="white" href="/" />
      <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-normal">
        {description}
      </p>
    </div>
  );
}

