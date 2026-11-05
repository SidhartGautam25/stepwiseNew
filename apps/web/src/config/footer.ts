import { PRODUCT_NAME } from '@app/contracts';

export interface FooterLinkItem {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface FooterColumnConfig {
  id: string;
  title: string;
  headerColorClass: string;
  links: FooterLinkItem[];
}

export interface FooterConfig {
  brandDescription: string;
  tagline: string;
  columns: FooterColumnConfig[];
}

export const FOOTER_CONFIG: FooterConfig = {
  brandDescription: 'Guided, test-driven workshops for learning how real software works.',
  tagline: 'Built for developers who learn by building.',
  columns: [
    {
      id: 'product',
      title: 'PRODUCT',
      headerColorClass: 'text-amber-400',
      links: [
        { label: 'Workshops', href: '/workshops' },
        { label: 'Reviews', href: '#reviews' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      id: 'resources',
      title: 'RESOURCES',
      headerColorClass: 'text-rose-400',
      links: [
        { label: 'Docs', href: '#docs' },
        { label: 'GitHub', href: 'https://github.com/handrail-dev', isExternal: true },
        { label: 'Changelog', href: '#changelog' },
      ],
    },
    {
      id: 'company',
      title: 'COMPANY',
      headerColorClass: 'text-sky-400',
      links: [
        { label: 'About', href: '#about' },
        { label: 'Privacy', href: '#privacy' },
        { label: 'Terms', href: '#terms' },
      ],
    },
  ],
};

