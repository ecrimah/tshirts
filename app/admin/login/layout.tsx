import type { Metadata } from 'next';
import { BRAND_ASSETS } from '@/lib/site-brand';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: BRAND_ASSETS.favicon32, sizes: '32x32', type: 'image/png' },
      { url: BRAND_ASSETS.favicon16, sizes: '16x16', type: 'image/png' },
    ],
    apple: BRAND_ASSETS.appleTouchIcon,
  },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
