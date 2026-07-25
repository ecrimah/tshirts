'use client';

import Link from 'next/link';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { useStorePricing } from '@/context/StorePricingContext';
import { getProductCardPricing } from '@/lib/pricing';

function mapProductCard(product: any, salesActive: boolean) {
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

  return {
    product,
    hasVariants,
    pricing,
    effectiveStock,
    colorVariants,
    badge,
  };
}

export default function HomeAutoProductMarquee({
  products,
  loading,
}: {
  products: any[];
  loading: boolean;
}) {
  const { salesActive } = useStorePricing();

  const cards = products.map((p) => mapProductCard(p, salesActive));
  const loop = cards.length > 0 ? [...cards, ...cards] : [];
  const durationSec = Math.max(28, cards.length * 5);

  return (
    <section className="py-14 md:py-20 bg-white overflow-hidden" aria-label="Product showcase">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 mb-8 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-store-ink tracking-tight">
            Fresh from the rack
          </h2>
          <p className="text-store-muted text-sm md:text-base mt-2 max-w-md">
            Tees and polos scrolling live from the catalog — grab yours before they&apos;re gone.
          </p>
        </div>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-semibold text-store-navy hover:text-store-primary transition-colors shrink-0"
        >
          View all products
          <i className="ri-arrow-right-line" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-5 px-4 sm:px-6 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-[220px] sm:w-[260px] shrink-0">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <p className="text-center text-store-muted px-6 py-8">Products will appear here once your catalog is live.</p>
      ) : (
        <div className="group/marquee relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-white to-transparent" />

          <div
            className="flex w-max gap-5 sm:gap-6 pl-4 sm:pl-6 animate-product-marquee group-hover/marquee:[animation-play-state:paused]"
            style={{ animationDuration: `${durationSec}s` }}
          >
            {loop.map((mapped, i) => {
              const p = mapped.product;
              return (
                <div
                  key={`${p.id}-${i}`}
                  className="w-[220px] sm:w-[260px] shrink-0"
                >
                  <ProductCard
                    compact
                    id={p.id}
                    slug={p.slug}
                    name={p.name}
                    price={mapped.pricing.price}
                    originalPrice={mapped.pricing.originalPrice}
                    image={p.product_images?.[0]?.url || '/logo.png'}
                    badge={mapped.badge}
                    inStock={mapped.effectiveStock > 0}
                    maxStock={mapped.effectiveStock || 50}
                    moq={p.moq || 1}
                    hasVariants={mapped.hasVariants}
                    minVariantPrice={mapped.pricing.minVariantPrice}
                    colorVariants={mapped.colorVariants}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
