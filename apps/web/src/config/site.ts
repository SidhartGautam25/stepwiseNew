import { PRODUCT_NAME } from '@app/contracts';

export const SITE_CONFIG = {
  name: PRODUCT_NAME,
  description: 'Guided learn-by-building platform for engineers.',
  tagline: 'Build real systems locally in your IDE with automated GitHub Actions verification.',
  links: {
    github: 'https://github.com/handrail-dev',
    docs: '/docs',
    workshops: '/workshops',
  },
} as const;

