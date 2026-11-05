import React from 'react';
import Link from 'next/link';
import { SITE_CONFIG } from '../../config/site';

export interface HandrailLogoProps {
  className?: string;
  showText?: boolean;
  href?: string;
  textColor?: 'black' | 'white';
}

export function HandrailLogo({
  className = '',
  showText = true,
  href = '/',
  textColor = 'black',
}: HandrailLogoProps) {
  const textColorClass = textColor === 'white' ? 'text-white' : 'text-black';

  const content = (
    <div className={`inline-flex items-center gap-2.5 group cursor-pointer ${className}`}>
      {/* Icon: Yellow square with crisp black border and handrail stair / zigzag icon */}
      <div className="w-8 h-8 bg-theme-yellow border-2 border-black rounded-[2px] flex items-center justify-center shadow-hard-sm group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Staircase/zigzag symbol representing steps */}
          <polyline points="4 20 8 16 12 16 16 12 20 12 20 4" />
        </svg>
      </div>

      {showText && (
        <span className={`font-extrabold text-xl tracking-tight ${textColorClass}`}>
          {SITE_CONFIG.name}
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
