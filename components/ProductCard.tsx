'use client';

import { useState } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';

// Map common color names to hex values for swatches
const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#FFD700', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  categoryName?: string;
  /** @deprecated Same layout as default; kept for call sites */
  variant?: 'default' | 'pressmart';
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
  /** Hide color swatches (e.g. homepage grid) */
  compact?: boolean;
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = [],
  compact = false,
}: ProductCardProps) {
  const { addToCart } = useCart();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const MAX_SWATCHES = 5;

  const formatPrice = (val: number) => `GH\u20B5${val.toFixed(2)}`;

  const isFeatured = badge?.toUpperCase() === 'FEATURED';
  const saleBadgeText =
    badge?.includes('%') ? badge : !isFeatured && discount > 0 ? `${discount}% OFF` : undefined;

  return (
    <article className="group flex h-full flex-col">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#f3ede4]">
        <Link href={`/product/${slug}`} className="block absolute inset-0">
          <LazyImage
            src={image}
            alt={name}
            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </Link>

        {isFeatured && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-900 shadow-sm">
            Featured
          </span>
        )}

        {saleBadgeText && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-900 shadow-sm">
            {saleBadgeText}
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/65 backdrop-blur-[1px]">
            <span className="rounded-lg bg-store-navy px-4 py-2 text-sm font-medium text-white">Out of Stock</span>
          </div>
        )}

        {inStock && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
            {hasVariants ? (
              <Link
                href={`/product/${slug}`}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 shadow-md transition-colors hover:bg-gray-50"
              >
                <i className="ri-list-check text-base" aria-hidden />
                Select Options
              </Link>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq });
                }}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 shadow-md transition-colors hover:bg-gray-50"
              >
                <i className="ri-shopping-cart-2-line text-base" aria-hidden />
                {moq > 1 ? `Add ${moq}` : 'Quick Add'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col pt-3 text-left">
        <Link href={`/product/${slug}`}>
          <h3 className="font-serif text-base md:text-lg leading-snug text-gray-900 line-clamp-2 transition-colors group-hover:text-store-primary">
            {name}
          </h3>
        </Link>

        {!compact && colorVariants.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
              <button
                key={color.name}
                type="button"
                title={color.name}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveColor(activeColor === color.name ? null : color.name);
                }}
                className={`h-3.5 w-3.5 shrink-0 rounded-full border transition-transform ${
                  activeColor === color.name ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-110'
                } ${color.hex === '#FFFFFF' ? 'border-gray-300' : 'border-transparent'}`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-sans text-sm font-bold text-gray-900 md:text-base">
            {hasVariants && minVariantPrice ? formatPrice(minVariantPrice) : formatPrice(displayPrice)}
          </span>
          {originalPrice && originalPrice > displayPrice && (
            <span className="text-xs text-gray-400 line-through md:text-sm">{formatPrice(originalPrice)}</span>
          )}
        </div>

        {inStock && (
          <div className="mt-3 lg:hidden">
            {hasVariants ? (
              <Link
                href={`/product/${slug}`}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-900"
              >
                Select Options
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq })}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-900"
              >
                Add to Cart
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
