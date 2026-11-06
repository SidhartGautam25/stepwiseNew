import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'default'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'purple'
  | 'beginner'
  | 'intermediate'
  | 'expert'
  | 'outline'
  | 'yellow'
  | 'pink'
  | 'blue'
  | 'white'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  hasShadow?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-white text-black',
  white: 'bg-white text-black',
  neutral: 'bg-theme-bg text-black',
  yellow: 'bg-theme-yellow text-black',
  pink: 'bg-theme-pink text-black',
  blue: 'bg-theme-blue text-black',
  emerald: 'bg-theme-green text-black',
  amber: 'bg-theme-yellow text-black',
  indigo: 'bg-theme-blue text-black',
  purple: 'bg-theme-purple text-black',
  beginner: 'bg-theme-green text-black',
  intermediate: 'bg-theme-blue text-black',
  expert: 'bg-theme-yellow text-black',
  outline: 'bg-transparent text-black border-2 border-black',
};

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  hasShadow = false,
  children,
  ...props
}: BadgeProps) {
  const shadowClass = hasShadow ? 'shadow-hard-sm' : '';

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-mono font-bold border-2 border-black rounded-[2px] uppercase tracking-tight',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          badgeVariants[variant],
          shadowClass,
          className,
        ),
      )}
      {...props}
    >
      {children}
    </span>
  );
}

