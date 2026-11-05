import { FOOTER_CONFIG } from '../config/footer';
import { PRODUCT_NAME } from '@app/contracts';

export function useFooter() {
  const currentYear = new Date().getFullYear();
  const copyrightText = `© ${currentYear} ${PRODUCT_NAME}. All rights reserved.`;

  return {
    columns: FOOTER_CONFIG.columns,
    brandDescription: FOOTER_CONFIG.brandDescription,
    tagline: FOOTER_CONFIG.tagline,
    copyrightText,
  };
}

