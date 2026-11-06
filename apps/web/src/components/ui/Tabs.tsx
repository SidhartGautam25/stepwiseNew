'use client';

import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs<T extends string>({
  items,
  activeId,
  onChange,
  className,
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 p-1 bg-transparent',
          className,
        ),
      )}
    >
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              'flex items-center justify-center font-mono font-bold border-2 border-black rounded-[2px] transition-all cursor-pointer select-none',
              size === 'sm' ? 'px-3 py-1 text-xs gap-1.5' : 'px-4 py-1.5 text-sm gap-2',
              isActive
                ? 'bg-theme-yellow text-black shadow-none'
                : 'bg-white hover:bg-slate-100 text-black shadow-hard-sm active:shadow-none',
            )}
          >
            <span>{tab.label}</span>
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}

