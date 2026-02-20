import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tiwaperfumestyle.com';

// Favicon & OG: uses tiwa logo.png from public
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TIWAA PERFUME STYLE HOUSE | Perfumes Wholesale & Retail — Satellite, Accra",
    template: "%s | TIWAA PERFUME STYLE HOUSE"
  },
  description: "I sell perfumes — wholesale and retail. Satellite, Accra. Call 054 501 0949 · WhatsApp 055 416 9992.",
  keywords: [
    "TIWAA PERFUME STYLE HOUSE",
    "perfumes Ghana",
    "wholesale perfumes Accra",
    "retail perfumes",
    "Satellite Accra",
    "fragrance Ghana",
    "Ghana perfumes",
    "Accra perfume shop"
  ],
  authors: [{ name: "TIWAA PERFUME STYLE HOUSE" }],
  creator: "TIWAA PERFUME STYLE HOUSE",
  publisher: "TIWAA PERFUME STYLE HOUSE",
  applicationName: "TIWAA PERFUME STYLE HOUSE",
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
      { url: '/tiwa logo.png', sizes: 'any', type: 'image/png' },
    ],
    shortcut: '/tiwa logo.png',
    apple: '/tiwa logo.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TIWAA PERFUME',
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
    title: "TIWAA PERFUME STYLE HOUSE | Perfumes Wholesale & Retail — Satellite, Accra",
    description: "I sell perfumes — wholesale and retail. Satellite, Accra. Call 054 501 0949 · WhatsApp 055 416 9992.",
    siteName: "TIWAA PERFUME STYLE HOUSE",
    images: [
      {
        url: "/tiwa logo.png",
        width: 1200,
        height: 630,
        alt: "TIWAA PERFUME STYLE HOUSE — Perfumes Wholesale & Retail",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TIWAA PERFUME STYLE HOUSE | Perfumes Wholesale & Retail",
    description: "I sell perfumes — wholesale and retail. Satellite, Accra. Call 054 501 0949 · WhatsApp 055 416 9992.",
    images: ["/tiwa logo.png"],
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
        <meta name="apple-mobile-web-app-title" content="TIWAA PERFUME" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Favicon from public folder */}
        <link rel="icon" href="/tiwa logo.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/tiwa logo.png" />

        {/* Apple Touch Icons from public */}
        <link rel="apple-touch-icon" href="/tiwa logo.png" />
        <link rel="apple-touch-startup-image" href="/tiwa logo.png" />

        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: fonts loaded in root layout apply to all pages */}
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "TIWAA PERFUME STYLE HOUSE",
              "url": siteUrl,
              "logo": siteUrl + "/tiwa%20logo.png",
              "description": "I sell perfumes — wholesale and retail. Satellite, Accra.",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "GH",
                "addressLocality": "Accra",
                "streetAddress": "Satellite, Accra"
              },
              "telephone": "+233545010949",
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "telephone": "+233545010949",
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

      <body className="antialiased font-sans overflow-x-hidden pwa-body">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <div id="main-content">
              {children}
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
