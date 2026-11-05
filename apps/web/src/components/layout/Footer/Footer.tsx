'use client';

import React from 'react';
import { useFooter } from '../../../hooks/use-footer';
import { FooterBrand } from './FooterBrand';
import { FooterLinks } from './FooterLinks';
import { FooterBottom } from './FooterBottom';

export interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  const { columns, brandDescription, tagline, copyrightText } = useFooter();

  return (
    <footer
      className={`w-full bg-[#0d0e11] text-white border-t-2 border-black px-6 sm:px-10 lg:px-12 py-12 sm:py-16 ${className}`}
    >
      <div className="max-w-5xl mx-auto">
        {/* Top: Brand Info on Left, grouped link columns on Right */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 lg:gap-20">
          {/* Brand Info */}
          <div className="max-w-xs shrink-0">
            <FooterBrand description={brandDescription} />
          </div>

          {/* 3 Link Columns with cohesive spacing between them */}
          <div className="shrink-0 w-full md:w-auto">
            <FooterLinks columns={columns} />
          </div>
        </div>

        {/* Bottom: Divider Line, Copyright & Tagline */}
        <FooterBottom copyright={copyrightText} tagline={tagline} />
      </div>
    </footer>
  );
}
