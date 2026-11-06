import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx('animate-pulse rounded-[2px] bg-[#E5E0D8] border-2 border-black/20', className),
      )}
      {...props}
    />
  );
}

