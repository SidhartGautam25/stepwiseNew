import React from 'react';
import Link from 'next/link';
import type { FooterColumnConfig } from '../../../config/footer';

export interface FooterColumnProps {
  column: FooterColumnConfig;
  className?: string;
}

export function FooterColumn({ column, className = '' }: FooterColumnProps) {
  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Category Title in Monospace Colored Font */}
      <h4
        className={`font-mono text-xs font-bold tracking-wider uppercase ${column.headerColorClass}`}
      >
        {column.title}
      </h4>

      {/* Links List */}
      <ul className="space-y-2.5">
        {column.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              target={link.isExternal ? '_blank' : undefined}
              rel={link.isExternal ? 'noopener noreferrer' : undefined}
              className="text-sm font-medium text-white hover:text-theme-yellow hover:underline decoration-2 underline-offset-4 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

