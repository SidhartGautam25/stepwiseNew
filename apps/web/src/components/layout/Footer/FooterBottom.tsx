import React from 'react';

export interface FooterBottomProps {
  copyright: string;
  tagline: string;
  className?: string;
}

export function FooterBottom({
  copyright,
  tagline,
  className = '',
}: FooterBottomProps) {
  return (
    <div
      className={`border-t border-zinc-700/80 pt-6 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-zinc-400 ${className}`}
    >
      <div>{copyright}</div>
      <div className="text-zinc-400">{tagline}</div>
    </div>
  );
}

