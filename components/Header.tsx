'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { api } from '@/lib/api';
import { useCMS } from '@/context/CMSContext';
import { useStorePricing } from '@/context/StorePricingContext';
import { resolveProductPrice } from '@/lib/pricing';
import { useDebouncedValue } from '@/components/useDebouncedValue';
import type { StorefrontSearchHit } from '@/lib/storefront-search-types';
import { resolveSiteLogo } from '@/lib/site-brand';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<StorefrontSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedSearch = useDebouncedValue(searchQuery, 280);
  const { salesActive } = useStorePricing();
  const [wishlistCount, setWishlistCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || process.env.NEXT_PUBLIC_SITE_NAME || 'Mamator';
  const headerLogo = resolveSiteLogo(getSetting('site_logo'));
  const contactEmail = getSetting('contact_email') || 'info@mamator.com';
  const contactPhone = getSetting('contact_phone') || '';

  useEffect(() => {
    // Wishlist logic
    const updateWishlistCount = () => {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wishlist.length);
    };

    updateWishlistCount();
    window.addEventListener('wishlistUpdated', updateWishlistCount);

    // Auth logic
    const checkUser = async () => {
      try {
        const me = await api<{ user: { id: string; email: string } | null }>('/api/auth/me');
        setUser(me.user);
      } catch {
        setUser(null);
      }
    };

    checkUser();

    return () => {
      window.removeEventListener('wishlistUpdated', updateWishlistCount);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const closeSearchOverlay = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchHits([]);
    setSearchLoading(false);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const q = debouncedSearch.trim();
    if (q.length < 1) {
      setSearchHits([]);
      setSearchLoading(false);
      return;
    }

    const ac = new AbortController();
    setSearchLoading(true);

    fetch(`/api/storefront/search?q=${encodeURIComponent(q)}&limit=12`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StorefrontSearchHit[]) => {
        if (!ac.signal.aborted) setSearchHits(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!ac.signal.aborted) setSearchHits([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setSearchLoading(false);
      });

    return () => ac.abort();
  }, [debouncedSearch, isSearchOpen]);

  return (
    <>
      <div className="hidden md:block bg-store-navy text-white text-xs">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <a href={`mailto:${contactEmail}`} className="hover:underline opacity-95">
              {contactEmail}
            </a>
            {contactPhone ? (
              <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="hover:underline opacity-95">
                {contactPhone}
              </a>
            ) : null}
          </div>
          <p className="opacity-95">Welcome to {siteName}!</p>
        </div>
      </div>

      <header className="bg-white sticky top-0 z-50 border-b border-gray-200 transition-all duration-300">
        <div className="safe-area-top" />
        <nav aria-label="Main navigation" className="relative">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="h-20 grid grid-cols-[auto_1fr_auto] items-center gap-4">

              {/* Left: Mobile Menu Trigger (Mobile) & Logo */}
              <div className="flex items-center gap-4">
                <button
                  className="lg:hidden p-2 -ml-2 text-gray-900 hover:text-gray-600 transition-colors"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="ri-menu-line text-2xl"></i>
                </button>
                <Link
                  href="/"
                  className="flex items-center select-none shrink-0"
                  aria-label={`${siteName} — home`}
                >
                  <img
                    src={headerLogo}
                    alt={siteName}
                    width={48}
                    height={48}
                    className="h-11 w-11 md:h-12 md:w-12 object-contain"
                  />
                </Link>
              </div>

              {/* Center: Navigation Links (Desktop) */}
              <div className="hidden lg:flex items-center justify-center gap-8 xl:gap-10">
                {[
                  { label: 'Home', href: '/' },
                  { label: 'Shop', href: '/shop' },
                  { label: 'Categories', href: '/categories' },
                  { label: 'Blog', href: '/blog' },
                  { label: 'About', href: '/about' },
                  { label: 'Contact', href: '/contact' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="py-2 text-sm font-semibold text-store-ink hover:text-store-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Right: Icons */}
              <div className="flex items-center justify-end space-x-2 sm:space-x-4">
                <button
                  className="p-2 text-gray-900 hover:text-gray-600 transition-transform hover:scale-105"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Search"
                >
                  <i className="ri-search-line text-xl"></i>
                </button>

                <Link
                  href="/wishlist"
                  className="p-2 text-gray-900 hover:text-gray-600 transition-transform hover:scale-105 relative hidden sm:block"
                  aria-label="Wishlist"
                >
                  <i className="ri-heart-line text-xl"></i>
                  {wishlistCount > 0 && (
                    <span className="absolute top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                {user ? (
                  <Link
                    href="/account"
                    className="p-2 text-gray-900 hover:text-gray-600 transition-transform hover:scale-105 hidden sm:block"
                    aria-label="Account"
                  >
                    <i className="ri-user-line text-xl"></i>
                  </Link>
                ) : (
                  <Link
                    href="/auth/login"
                    className="p-2 text-gray-900 hover:text-gray-600 transition-transform hover:scale-105 hidden sm:block"
                    aria-label="Login"
                  >
                    <i className="ri-user-line text-xl"></i>
                  </Link>
                )}

                <div className="relative">
                  <button
                    className="relative p-2 text-store-ink hover:text-store-primary transition-colors"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label="Cart"
                  >
                    <i className="ri-shopping-cart-2-line text-xl"></i>
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] px-1 items-center justify-center rounded-full bg-store-primary text-[10px] font-bold text-store-navy">
                        {cartCount}
                      </span>
                    )}
                  </button>
                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>
              </div>

            </div>
          </div>
        </nav>
      </header>

      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center pt-16 sm:pt-0 px-3 opacity-0 animate-fade-in overflow-y-auto" style={{ animationFillMode: 'forwards' }}>
          {/* Blurred Dark Backdrop */}
          <div
            className="absolute inset-0 bg-stone-950/90 backdrop-blur-xl"
            onClick={closeSearchOverlay}
            aria-hidden="true"
          />

          {/* Search Content */}
          <div
            className="relative w-full max-w-4xl mx-auto transform translate-y-4 sm:translate-y-8 animate-fade-in-up pb-8"
            style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSearchOverlay}
              className="absolute -top-14 sm:-top-20 right-0 w-12 h-12 flex items-center justify-center text-stone-400 hover:text-white hover:rotate-90 transition-all duration-500 group"
              aria-label="Close search"
            >
              <i className="ri-close-line text-4xl"></i>
            </button>

            <form onSubmit={handleSearch} className="relative group">
              <div className="relative flex items-center">
                <i className="ri-search-line text-2xl sm:text-3xl md:text-4xl text-stone-500 group-focus-within:text-white transition-colors duration-500 absolute left-0"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Start typing — products appear as you go"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls="storefront-search-results"
                  className="w-full bg-transparent border-none pl-10 sm:pl-12 md:pl-16 py-3 sm:py-4 md:py-6 text-xl sm:text-3xl md:text-5xl lg:text-6xl text-white placeholder-stone-600 focus:outline-none focus:ring-0 font-serif tracking-wide transition-all"
                  autoFocus
                />
              </div>

              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-stone-800">
                <div className="h-full bg-white w-0 group-focus-within:w-full transition-all duration-700 ease-in-out" />
              </div>
            </form>

            <div
              id="storefront-search-results"
              className="mt-6 sm:mt-8 rounded-2xl border border-white/10 bg-stone-900/80 backdrop-blur-md shadow-2xl overflow-hidden max-h-[min(55vh,420px)] overflow-y-auto"
              role="listbox"
              aria-label="Matching products"
            >
              {searchLoading && searchQuery.trim() && (
                <div className="p-6 flex items-center justify-center gap-3 text-stone-400 text-sm">
                  <i className="ri-loader-4-line text-xl animate-spin" aria-hidden />
                  Finding products…
                </div>
              )}

              {!searchLoading &&
                searchQuery.trim() &&
                debouncedSearch.trim() &&
                searchHits.length === 0 && (
                  <div className="p-8 text-center text-stone-500 text-sm">No products match that yet — try another letter or press Enter to search the shop.</div>
                )}

              {!searchLoading && searchHits.length > 0 && (
                <ul className="divide-y divide-white/5">
                  {searchHits.map((p) => {
                    const { effective, originalDisplay } = resolveProductPrice({
                      salesActive,
                      price: Number(p.price) || 0,
                      salePrice: p.sale_price,
                      compareAtPrice: p.compare_at_price,
                    });
                    const img = p.image || '/logo.png';
                    return (
                      <li key={p.id}>
                        <Link
                          href={`/product/${encodeURIComponent(p.slug)}`}
                          onClick={closeSearchOverlay}
                          className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl overflow-hidden bg-stone-800 ring-1 ring-white/10">
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover object-center"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm sm:text-base leading-snug line-clamp-2">{p.name}</p>
                            {p.categoryName && (
                              <p className="text-stone-500 text-xs mt-0.5 truncate">{p.categoryName}</p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-white font-semibold text-sm sm:text-base whitespace-nowrap">GH₵{effective.toFixed(2)}</p>
                            {originalDisplay != null && originalDisplay > effective && (
                              <p className="text-stone-500 text-xs line-through">GH₵{originalDisplay.toFixed(2)}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!searchQuery.trim() && (
                <div className="p-6 text-center text-stone-500 text-sm">Type a letter to see products that start with it.</div>
              )}
            </div>

            <div className="mt-6 opacity-0 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
              <p className="text-stone-500 text-xs sm:text-sm tracking-[0.15em] uppercase text-center flex items-center justify-center gap-3">
                <span className="w-8 h-px bg-stone-800" />
                Enter — search shop
                <span className="w-8 h-px bg-stone-800" />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-4/5 max-w-xs bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img src={headerLogo} alt={siteName} className="h-12 w-12 object-contain" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-gray-500 hover:text-gray-900"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {[
                { label: 'Home', href: '/' },
                { label: 'Shop', href: '/shop' },
                { label: 'Categories', href: '/categories' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-lg font-medium text-gray-700 hover:bg-stone-50 hover:text-stone-700 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-gray-100 my-2"></div>
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                &copy; {new Date().getFullYear()} {siteName}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}