import { asNumber } from '@/lib/format-money';

export type StorefrontVariant = {
  id: string;
  name: string;
  color: string;
  colorHex: string;
  price: number;
  quantity: number;
  sku?: string | null;
  sale_price?: number | null;
};

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  black: '#111827',
  white: '#ffffff',
  gray: '#6b7280',
  grey: '#6b7280',
  brown: '#92400e',
  navy: '#1e3a5f',
  gold: '#d4a017',
  silver: '#c0c0c0',
  beige: '#f5f5dc',
  maroon: '#800000',
  teal: '#14b8a6',
  coral: '#ff7f50',
  ivory: '#fffff0',
  cream: '#fffdd0',
  burgundy: '#800020',
  lavender: '#e6e6fa',
  cyan: '#06b6d4',
  magenta: '#d946ef',
  olive: '#84cc16',
  peach: '#ffcba4',
  mint: '#98f5e1',
  rose: '#f43f5e',
  wine: '#722f37',
  charcoal: '#374151',
  sky: '#0ea5e9',
};

export function colorNameToHex(name: string): string {
  return COLOR_HEX[name.toLowerCase().trim()] || '#d1d5db';
}

/** SQL fragment: product_variants column for product list/detail queries. */
export const PRODUCT_VARIANTS_JSON_SQL = `
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id', pv.id,
        'name', pv.name,
        'sku', pv.sku,
        'price', pv.price,
        'sale_price', pv.sale_price,
        'quantity', pv.quantity,
        'option1', pv.option1,
        'option2', pv.option2,
        'option3', pv.option3,
        'metadata', pv.metadata
      ) ORDER BY pv.created_at
    )
     FROM product_variants pv WHERE pv.product_id = p.id),
    '[]'::jsonb
  ) AS product_variants`;

export function normalizeStorefrontVariants(
  raw: unknown[],
  basePrice: unknown
): { variants: StorefrontVariant[]; colors: string[]; colorHexMap: Record<string, string> } {
  const fallbackPrice = asNumber(basePrice);
  const colorHexMap: Record<string, string> = {};
  const variants: StorefrontVariant[] = [];

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const v = row as Record<string, unknown>;
    const id = String(v.id ?? '');
    if (!id) continue;

    const color = String(v.option2 ?? v.color ?? '').trim();
    const name = String(v.name ?? v.option1 ?? 'Default').trim() || 'Default';
    const meta =
      v.metadata && typeof v.metadata === 'object'
        ? (v.metadata as Record<string, unknown>)
        : {};
    const colorHex = String(meta.color_hex ?? '').trim();

    if (color && !colorHexMap[color]) {
      colorHexMap[color] = colorHex || colorNameToHex(color);
    }

    variants.push({
      id,
      name,
      color,
      colorHex: color ? colorHexMap[color] : '',
      price: asNumber(v.price, fallbackPrice),
      quantity: asNumber(v.quantity),
      sku: (v.sku as string | null | undefined) ?? null,
      sale_price: v.sale_price != null ? asNumber(v.sale_price) : null,
    });
  }

  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
  return { variants, colors, colorHexMap };
}

export function variantSizesForColor(
  variants: StorefrontVariant[],
  selectedColor: string
): string[] {
  const pool = selectedColor
    ? variants.filter((v) => v.color === selectedColor)
    : variants;
  return [...new Set(pool.map((v) => v.name).filter(Boolean))];
}

export function findVariant(
  variants: StorefrontVariant[],
  selectedColor: string,
  selectedSize: string
): StorefrontVariant | null {
  if (!selectedSize) return null;
  return (
    variants.find(
      (v) =>
        v.name === selectedSize &&
        (!selectedColor || !v.color || v.color === selectedColor)
    ) ?? null
  );
}

export function variantStock(variant: StorefrontVariant | null, productQty: unknown): number {
  if (variant) return variant.quantity;
  return asNumber(productQty);
}
