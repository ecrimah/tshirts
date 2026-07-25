"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';
import { resolveSiteLogo } from '@/lib/site-brand';

const footerLinkClass =
  'text-white/90 hover:text-store-primary transition-colors text-sm leading-relaxed';

function SocialButton({ href, label, icon }: { href: string; label: string; icon: string }) {
  if (!href || href === '#') {
    return (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-store-navy-light text-white/70"
        aria-hidden
      >
        <i className={`${icon} text-lg`} />
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-store-navy-light text-white hover:bg-store-primary hover:text-store-navy transition-colors"
    >
      <i className={`${icon} text-lg`} />
    </a>
  );
}

function formatGhanaPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 12 && digits.startsWith('233')) {
    const local = `0${digits.slice(3)}`;
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return raw;
}

function phoneTelHref(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return `tel:+233${digits.slice(1)}`;
  if (digits.startsWith('233')) return `tel:+${digits}`;
  return `tel:${digits}`;
}

export default function Footer() {
  const { getSetting } = useCMS();
  const pathname = usePathname();

  const siteName = getSetting('site_name') || 'Mamator';
  const legalName = getSetting('company_legal_name') || 'Mamator Trading Enterprise';
  const siteLogo = resolveSiteLogo(getSetting('site_logo'));
  const address = getSetting('contact_address') || 'Accra, Kasoa, Koforidua';
  const email = getSetting('contact_email') || 'info@mamator.com';
  const phonePrimary = formatGhanaPhoneDisplay(getSetting('contact_phone') || '0249628324');
  const phoneSecondary = formatGhanaPhoneDisplay(
    getSetting('contact_phone_secondary') || '0553188619'
  );
  const tagline =
    getSetting('site_tagline') || `Quality products from ${legalName}.`;

  const socials = [
    { href: getSetting('social_instagram'), label: 'Instagram', icon: 'ri-instagram-line' },
    { href: getSetting('social_tiktok'), label: 'TikTok', icon: 'ri-tiktok-line' },
    { href: getSetting('social_snapchat'), label: 'Snapchat', icon: 'ri-snapchat-line' },
    { href: getSetting('social_youtube'), label: 'YouTube', icon: 'ri-youtube-line' },
    {
      href: getSetting('social_twitter') || getSetting('social_x'),
      label: 'X',
      icon: 'ri-twitter-x-line',
    },
  ];

  return (
    <footer className="relative mt-8 bg-store-navy text-white rounded-t-[2.5rem] overflow-hidden">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-14 pb-10 md:pt-16 md:pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 overflow-hidden">
                <img src={siteLogo} alt="" className="h-10 w-10 object-contain" />
              </span>
              <span>
                <span className="block font-serif text-xl font-bold tracking-wide uppercase">
                  {siteName.replace(/\s+/g, ' ')}
                  <sup className="text-[10px] align-super ml-0.5">®</sup>
                </span>
                <span className="block text-[10px] tracking-[0.2em] uppercase text-white/70 mt-0.5">
                  Trading Enterprise
                </span>
              </span>
            </Link>

            <div className="text-sm text-white/80 leading-relaxed max-w-sm space-y-1.5">
              <p>{tagline}</p>
              <p>{address}.</p>
              <p>
                Call{' '}
                <a
                  href={phoneTelHref(getSetting('contact_phone') || '0249628324')}
                  className="hover:text-store-primary transition-colors"
                >
                  {phonePrimary}
                </a>
                {' / '}
                <a
                  href={phoneTelHref(getSetting('contact_phone_secondary') || '0553188619')}
                  className="hover:text-store-primary transition-colors"
                >
                  {phoneSecondary}
                </a>
                .
              </p>
              <p>
                <a
                  href={`mailto:${email}`}
                  className="hover:text-store-primary transition-colors"
                >
                  {email}
                </a>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {socials.map((s) => (
                <SocialButton key={s.label} href={s.href} label={s.label} icon={s.icon} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 lg:pl-8">
            <div>
              <h4 className="font-serif text-lg font-bold text-white mb-5">Shop</h4>
              <ul className="space-y-3">
                <li><Link href="/shop" className={footerLinkClass}>All Products</Link></li>
                <li><Link href="/categories" className={footerLinkClass}>Collections</Link></li>
                <li><Link href="/shop?sort=newest" className={footerLinkClass}>New Arrivals</Link></li>
                <li><Link href="/shop?sort=bestsellers" className={footerLinkClass}>Best Sellers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-serif text-lg font-bold text-white mb-5">Support</h4>
              <ul className="space-y-3">
                <li><Link href="/contact" className={footerLinkClass}>Contact Us</Link></li>
                <li><Link href="/order-tracking" className={footerLinkClass}>Track Order</Link></li>
                <li><Link href="/shipping" className={footerLinkClass}>Shipping &amp; Delivery</Link></li>
                <li>
                  <Link
                    href="/returns"
                    className={`text-sm leading-relaxed transition-colors ${
                      pathname === '/returns'
                        ? 'text-store-primary'
                        : 'text-white/90 hover:text-store-primary'
                    }`}
                  >
                    Returns &amp; Exchange
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-serif text-lg font-bold text-white mb-5">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/about" className={footerLinkClass}>Our Story</Link></li>
                <li><Link href="/privacy" className={footerLinkClass}>Privacy Policy</Link></li>
                <li><Link href="/terms" className={footerLinkClass}>Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-store-muted text-center md:text-left">
            <Link
              href="/admin/login"
              className="hover:text-store-primary transition-colors"
              aria-label="Admin login"
              title="Admin"
            >
              &copy;
            </Link>{' '}
            {new Date().getFullYear()} {legalName}. All rights reserved.
          </p>
          <div className="flex gap-4 text-store-muted text-2xl" aria-label="Accepted payment methods">
            <i className="ri-visa-line" aria-hidden />
            <i className="ri-mastercard-line" aria-hidden />
            <i className="ri-paypal-line" aria-hidden />
          </div>
        </div>
      </div>
    </footer>
  );
}
