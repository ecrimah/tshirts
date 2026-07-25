import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Pacifico, Playfair_Display, Outfit } from "next/font/google";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import StoreLayoutShell from "@/components/StoreLayoutShell";
import {
  absoluteAsset,
  BRAND_ASSETS,
  getSiteUrl,
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
  SITE_KEYWORDS,
  SITE_LEGAL_NAME,
} from "@/lib/site-brand";
import { getRootStructuredData } from "@/lib/site-jsonld";
import "./globals.css";

const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: '--font-pacifico' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

const siteUrl = getSiteUrl();
const ogImageUrl = absoluteAsset(BRAND_ASSETS.ogImage);
const logoUrl = absoluteAsset(BRAND_ASSETS.logo);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a1931',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_DEFAULT_TITLE,
    template: `%s | Mamator`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  keywords: [...SITE_KEYWORDS],
  authors: [{ name: SITE_LEGAL_NAME, url: siteUrl }],
  creator: SITE_LEGAL_NAME,
  publisher: SITE_LEGAL_NAME,
  applicationName: 'Mamator',
  referrer: 'origin-when-cross-origin',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: BRAND_ASSETS.favicon16, sizes: '16x16', type: 'image/png' },
      { url: BRAND_ASSETS.favicon32, sizes: '32x32', type: 'image/png' },
      { url: BRAND_ASSETS.logo, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: BRAND_ASSETS.favicon32,
    apple: [{ url: BRAND_ASSETS.appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mamator',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    url: siteUrl,
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    siteName: 'Mamator',
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: `${SITE_LEGAL_NAME} — shop tees online in Ghana`,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    images: [ogImageUrl],
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      'en-GH': siteUrl,
    },
  },
  category: 'shopping',
  other: {
    'og:logo': logoUrl,
  },
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GH">
      <head>
        <meta name="theme-color" content="#0a1931" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Mamator" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0a1931" />
        <meta name="msapplication-TileImage" content={BRAND_ASSETS.icon192} />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="icon" href={BRAND_ASSETS.favicon32} type="image/png" sizes="32x32" />
        <link rel="icon" href={BRAND_ASSETS.favicon16} type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href={BRAND_ASSETS.appleTouchIcon} sizes="180x180" />

        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getRootStructuredData()),
          }}
        />
      </head>

      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className={`antialiased overflow-x-hidden pwa-body ${pacifico.variable} ${playfair.variable} ${outfit.variable} font-sans`} style={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-store-navy-light focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <StoreLayoutShell>{children}</StoreLayoutShell>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
