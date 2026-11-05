import React from 'react';

export type BadgeVariant = 'pink' | 'white' | 'yellow' | 'blue' | 'neutral';

export interface NeoBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  hasShadow?: boolean;
}

export function NeoBadge({
  variant = 'white',
  children,
  className = '',
  hasShadow = false,
}: NeoBadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    pink: 'bg-theme-pink text-black',
    white: 'bg-white text-black',
    yellow: 'bg-theme-yellow text-black',
    blue: 'bg-theme-blue text-black',
    neutral: 'bg-theme-bg text-black',
  };

  const shadowClass = hasShadow ? 'shadow-hard-sm' : '';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium border-2 border-black rounded-[2px] ${variantClasses[variant]} ${shadowClass} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

