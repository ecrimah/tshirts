import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Pacifico, Playfair_Display, Outfit } from "next/font/google";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import StoreLayoutShell from "@/components/StoreLayoutShell";
import "./globals.css";

const pacifico = Pacifico({ weight: '400', subsets: ['latin'], variable: '--font-pacifico' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mamator.com';

// Favicon & OG from public: add favicon.ico, favicon.png, og-image.png (1200×630) to public as needed
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Mamator | Shop Online in Ghana",
    template: "%s | Mamator"
  },
  description: "Mamator – quality products with delivery across Ghana.",
  keywords: [
    "Mamator",
    "Hair care",
    "Beauty",
    "Mataheko",
    "Ghana",
    "Women’s fashion",
    "E-commerce",
    "Shop online"
  ],
  authors: [{ name: "Mamator" }],
  creator: "Mamator",
  publisher: "Mamator",
  applicationName: "Mamator",
  referrer: "origin-when-cross-origin",
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
      { url: '/logo.png', sizes: 'any', type: 'image/png' },
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mamator',
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: siteUrl,
    title: "Mamator | Shop Online in Ghana",
    description: "Mamator – quality products with delivery across Ghana.",
    siteName: "Mamator",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Mamator - Shop Online in Ghana",
        type: "image/png",
      },
      { url: "/logo.png", width: 1200, height: 630, alt: "Mamator", type: "image/png" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mamator | Shop Online in Ghana",
    description: "Mamator – quality products with delivery across Ghana.",
    images: ["/logo.png"],
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "shopping",
};

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
// Google reCAPTCHA v3 Site Key
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mamator" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Favicon: logo */}
        <link rel="icon" href="/logo.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/logo.png" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="apple-touch-startup-image" href="/logo.png" />

        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Mamator",
              "url": siteUrl,
              "logo": siteUrl + "/logo.png",
              "description": "Mamator – quality products with delivery across Ghana.",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Kpakpo mankralo road 55",
                "addressLocality": "Mataheko"
              },
              "telephone": "+233547742920",
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "telephone": "+233547742920",
                "areaServed": "GH",
                "availableLanguage": "English"
              }
            })
          }}
        />
      </head>

      {/* Google Analytics */}
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

      {/* Google reCAPTCHA v3 */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="afterInteractive"
        />
      )}

      <body className={`antialiased overflow-x-hidden pwa-body ${pacifico.variable} ${playfair.variable} ${outfit.variable} font-sans`} style={{ fontFamily: 'var(--font-outfit), system-ui, sans-serif' }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-stone-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
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
