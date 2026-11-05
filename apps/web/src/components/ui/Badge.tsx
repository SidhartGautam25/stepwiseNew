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
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  emerald: 'bg-emerald-950 text-emerald-300 border-emerald-800/80',
  amber: 'bg-amber-950 text-amber-300 border-amber-800/80',
  indigo: 'bg-indigo-950 text-indigo-300 border-indigo-800/80',
  purple: 'bg-purple-950 text-purple-300 border-purple-800/80',
  beginner: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
  intermediate: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
  expert: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
  outline: 'bg-transparent text-slate-400 border-slate-800',
};

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-medium border rounded-full uppercase tracking-wider',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          badgeVariants[variant],
          className,
        ),
      )}
      {...props}
    >
      {children}
    </span>
  );
}
