import React from 'react';
import Link from 'next/link';
import type { NavLinkItem } from '../../../hooks/use-navbar';

export interface NavLinksProps {
  links: NavLinkItem[];
  className?: string;
}

export function NavLinks({ links, className = '' }: NavLinksProps) {
  return (
    <nav className={`flex items-center gap-8 ${className}`}>
      {links.map((link) => (
        <Link
          key={link.id}
          href={link.href}
          className={`text-sm font-bold text-black hover:underline decoration-2 underline-offset-4 transition-colors ${
            link.isActive ? 'underline' : ''
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

