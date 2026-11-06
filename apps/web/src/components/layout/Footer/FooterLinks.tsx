import React from 'react';
import type { FooterColumnConfig } from '../../../config/footer';
import { FooterColumn } from './FooterColumn';

export interface FooterLinksProps {
  columns: FooterColumnConfig[];
  className?: string;
}

export function FooterLinks({ columns, className = '' }: FooterLinksProps) {
  return (
    <div
      className={`grid grid-cols-3 gap-8 sm:gap-10 lg:gap-12 ${className}`}
    >
      {columns.map((column) => (
        <FooterColumn key={column.id} column={column} />
      ))}
    </div>
  );
}
