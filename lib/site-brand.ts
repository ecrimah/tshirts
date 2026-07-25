/** Shared brand URLs and SEO copy for metadata, JSON-LD, and PWA. */

export const SITE_LEGAL_NAME = 'Mamator Trading Enterprise';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://mamator.com').replace(/\/+$/, '');
}

export const SITE_DEFAULT_TITLE = 'Mamator | Premium T-Shirts & Tees Online in Ghana';

export const SITE_DEFAULT_DESCRIPTION =
  'Shop graphic tees, plain basics, polos & performance shirts from Mamator Trading Enterprise. Quality apparel with delivery across Ghana — Accra, Kasoa, Koforidua & nationwide.';

export const SITE_KEYWORDS = [
  'Mamator',
  'Mamator Trading Enterprise',
  't-shirts Ghana',
  'graphic tees Ghana',
  'polo shirts Ghana',
  'buy tees online Ghana',
  'wholesale t-shirts Ghana',
  'Accra online shop',
  'Kasoa shop',
  'Koforidua shop',
  'Ghana e-commerce',
  'Mamator tees',
] as const;

export const BRAND_ASSETS = {
  logo: '/logo.png',
  logo512: '/icon-512.png',
  ogImage: '/og-image.png',
  appleTouchIcon: '/apple-touch-icon.png',
  favicon32: '/favicon-32.png',
  favicon16: '/favicon-16.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
  iconMaskable192: '/icon-maskable-192.png',
  iconMaskable512: '/icon-maskable-512.png',
} as const;

export function absoluteAsset(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Default contact for structured data (overridden when site_settings are populated). */
export const SITE_CONTACT = {
  email: 'info@mamator.com',
  phonePrimary: '+233249628324',
  phoneSecondary: '+233553188619',
  areaServed: 'GH',
  addressLocality: 'Accra, Kasoa, Koforidua',
} as const;
