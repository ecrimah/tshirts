'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { useStorePricing } from '@/context/StorePricingContext';
import { getProductCardPricing } from '@/lib/pricing';

type TabId = 'new' | 'best' | 'top';

const TABS: { id: TabId; label: string }[] = [
  { id: 'new', label: 'New Arrival' },
  { id: 'best', label: 'Best Selling' },
  { id: 'top', label: 'Top Rated' },
];

function mapProduct(product: any, salesActive: boolean) {
  const variants = product.product_variants || [];
  const hasVariants = variants.length > 0;
  const pricing = getProductCardPricing(product, salesActive);
  const totalVariantStock = hasVariants
    ? variants.reduce((sum: number, v: { quantity?: number }) => sum + (v.quantity || 0), 0)
    : 0;
  const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

  const colorVariants: ColorVariant[] = [];
  const seenColors = new Set<string>();
  for (const v of variants) {
    const colorName = (v as { option2?: string }).option2;
    if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
      const hex = getColorHex(colorName);
      if (hex) {
        seenColors.add(colorName.toLowerCase().trim());
        colorVariants.push({ name: colorName.trim(), hex });
      }
    }
  }

  const discountPct =
    pricing.originalPrice && pricing.originalPrice > pricing.price
      ? Math.round((1 - pricing.price / pricing.originalPrice) * 100)
      : 0;

  let badge: string | undefined;
  if (product.featured) badge = 'FEATURED';
  else if (discountPct >= 5) badge = `${discountPct}% OFF`;

  const categoryName =
    product.categories?.name ||
    (typeof product.categories === 'object' && product.categories?.name) ||
    undefined;

  return {
    product,
    hasVariants,
    pricing,
    effectiveStock,
    colorVariants,
    badge,
    categoryName,
  };
}

export default function HomeFeaturedProductsTabs({
  featuredProducts,
  catalogProducts,
  loading,
}: {
  featuredProducts: any[];
  catalogProducts: any[];
  loading: boolean;
}) {
  const { salesActive } = useStorePricing();
  const [tab, setTab] = useState<TabId>('new');

  const sorted = useMemo(() => {
    if (tab === 'best') {
      return [...featuredProducts].slice(0, 10);
    }
    const list = [...catalogProducts];
    if (tab === 'new') {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    } else {
      list.sort((a, b) => Number(b.rating_avg || 0) - Number(a.rating_avg || 0));
    }
    return list.slice(0, 10);
  }, [featuredProducts, catalogProducts, tab]);

  return (
    <section className="py-12 md:py-16 bg-store-surface">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between mb-10">
          <h2 className="text-2xl md:text-[1.75rem] font-bold text-store-navy tracking-tight shrink-0">
            Featured Tees
          </h2>
          <nav
            className="flex flex-wrap items-center gap-6 sm:gap-8 md:gap-10"
            aria-label="Featured product filters"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`text-sm md:text-[15px] font-semibold pb-2 border-b-[2px] transition-colors whitespace-nowrap ${
                    active
                      ? 'text-store-primary border-store-primary'
                      : 'text-store-navy border-transparent hover:text-store-primary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
            {[...Array(5)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-store-muted py-12">
            {tab === 'best'
              ? 'Mark products as “Feature on homepage” in admin to show them here.'
              : 'Products will appear here once your catalog is live.'}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
            {sorted.map((product) => {
              const mapped = mapProduct(product, salesActive);
              const p = mapped.product;
              return (
                <ProductCard
                  key={p.id}
                  compact
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  price={mapped.pricing.price}
                  originalPrice={mapped.pricing.originalPrice}
                  image={p.product_images?.[0]?.url || '/logo.png'}
                  rating={Number(p.rating_avg) || 5}
                  reviewCount={p.review_count || 0}
                  badge={mapped.badge}
                  inStock={mapped.effectiveStock > 0}
                  maxStock={mapped.effectiveStock || 50}
                  moq={p.moq || 1}
                  hasVariants={mapped.hasVariants}
                  minVariantPrice={mapped.pricing.minVariantPrice}
                  colorVariants={mapped.colorVariants}
                />
              );
            })}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-10 py-3.5 bg-store-primary text-store-navy text-xs font-bold uppercase tracking-[0.15em] hover:bg-store-primary-dark transition-colors"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  );
}
