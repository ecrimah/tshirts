/**
 * Create products, product_images, and product_variants from parsed CSV rows.
 * Groups rows by product name only (SKU is auto-generated). Variants use Color × Size (option1=size, option2=color, metadata.color_hex).
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ParsedProductRow } from './csv-parser';
import { sanitizeHtml } from '@/lib/sanitize';

const PRESET_COLOR_HEX: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#EF4444',
  blue: '#3B82F6',
  navy: '#1E3A5F',
  green: '#22C55E',
  yellow: '#EAB308',
  pink: '#EC4899',
  purple: '#A855F7',
  orange: '#F97316',
  gray: '#6B7280',
  brown: '#92400E',
  beige: '#D2B48C',
  maroon: '#800000',
  teal: '#14B8A6',
  cream: '#FFFDD0',
  gold: '#D4AF37',
  silver: '#C0C0C0',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function generateSku(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SLI-${timestamp}-${random}`;
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const { data } = await supabaseAdmin.from('products').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${n}`;
    n++;
  }
}

function resolveColorHex(colorName: string | undefined, hexFromCsv: string | undefined): string | null {
  if (hexFromCsv?.trim()) return hexFromCsv.trim();
  if (!colorName?.trim()) return null;
  const key = colorName.trim().toLowerCase();
  return PRESET_COLOR_HEX[key] ?? null;
}

export interface CategoryLookup {
  byName: Map<string, string>;
}

export async function buildCategoryLookup(): Promise<CategoryLookup> {
  const { data: categories, error } = await supabaseAdmin
    .from('categories')
    .select('id, name')
    .eq('status', 'active');
  if (error) return { byName: new Map() };
  const byName = new Map<string, string>();
  for (const c of categories ?? []) {
    const key = (c.name ?? '').trim().toLowerCase();
    if (key) byName.set(key, c.id);
  }
  return { byName };
}

export async function getExistingProductNames(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('products').select('name');
  if (error) return new Set();
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.name) set.add(String(row.name).trim().toLowerCase());
  }
  return set;
}

/** Map lowercase product name -> product id (for update-existing flow). */
export async function getExistingProductIdsByName(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin.from('products').select('id, name');
  if (error) return new Map();
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.name) map.set(String(row.name).trim().toLowerCase(), row.id);
  }
  return map;
}

export interface CreateProductResult {
  rowIndex: number;
  name: string;
  status: 'success' | 'error' | 'skipped';
  productId?: string;
  error?: string;
  skipped?: boolean;
}

function groupRowsByProductName(rows: ParsedProductRow[]): ParsedProductRow[][] {
  const groups: ParsedProductRow[][] = [];
  const keyToIndex = new Map<string, number>();

  for (const row of rows) {
    const key = (row.name ?? '').trim().toLowerCase() || `row-${row.rowIndex}`;
    let idx = keyToIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      keyToIndex.set(key, idx);
      groups.push([]);
    }
    groups[idx].push(row);
  }
  return groups;
}

export async function createProductsFromRows(
  rows: ParsedProductRow[],
  imageUrlMap: Map<string, string>,
  categoryLookup: CategoryLookup,
  existingNames: Set<string>,
  existingIdsByName: Map<string, string>,
  updateExisting: boolean,
  onProduct?: (result: CreateProductResult) => void
): Promise<{ created: number; variants: number; errors: number; skipped: number }> {
  const groups = groupRowsByProductName(rows);
  let created = 0;
  let variantsCreated = 0;
  let errors = 0;
  let skipped = 0;

  for (const group of groups) {
    const first = group[0];
    const nameKey = first.name.trim().toLowerCase();
    const exists = existingNames.has(nameKey);

    if (exists && !updateExisting) {
      skipped++;
      for (const r of group) {
        onProduct?.({
          rowIndex: r.rowIndex,
          name: r.name,
          status: 'skipped',
          skipped: true,
        });
      }
      continue;
    }

    const categoryId = first.category
      ? categoryLookup.byName.get(first.category.trim().toLowerCase())
      : undefined;

    const baseSlug = slugify(first.name) || 'product';
    const slug = await ensureUniqueSlug(baseSlug);
    const sku = generateSku();

    const description = first.description ? sanitizeHtml(first.description) : null;
    const tags = first.tags?.length ? first.tags : null;
    const hasVariants = group.some(
      (r) => r.variant_color || r.variant_size || r.variant_price !== undefined || (r.variant_stock !== undefined && r.variant_stock > 0)
    );
    const totalQuantity = hasVariants
      ? group.reduce((sum, r) => sum + (r.variant_stock ?? 0), 0)
      : (first.quantity ?? 0);

    const productPayload = {
      name: first.name,
      slug,
      sku,
      description,
      price: first.price,
      compare_at_price: first.compare_at_price ?? null,
      quantity: totalQuantity,
      moq: Math.max(1, first.moq ?? 1),
      status: first.status ?? 'draft',
      featured: first.featured ?? false,
      seo_title: first.seo_title || null,
      seo_description: first.seo_description || null,
      tags,
      category_id: categoryId ?? null,
      metadata: {
        low_stock_threshold: first.low_stock_threshold ?? 5,
        preorder_shipping: first.preorder_shipping?.trim() || null,
      },
    };

    let productId: string | null = null;

    if (exists && updateExisting) {
      const existingId = existingIdsByName.get(nameKey);
      if (existingId) {
        const { error: updateErr } = await supabaseAdmin
          .from('products')
          .update({
            description: productPayload.description,
            price: productPayload.price,
            compare_at_price: productPayload.compare_at_price,
            quantity: productPayload.quantity,
            moq: productPayload.moq,
            status: productPayload.status,
            featured: productPayload.featured,
            seo_title: productPayload.seo_title,
            seo_description: productPayload.seo_description,
            tags: productPayload.tags,
            category_id: productPayload.category_id,
            metadata: productPayload.metadata,
          })
          .eq('id', existingId);
        if (updateErr) {
          errors++;
          onProduct?.({ rowIndex: first.rowIndex, name: first.name, status: 'error', error: updateErr.message });
          continue;
        }
        productId = existingId;
      }
    }

    if (!productId) {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('products')
        .insert(productPayload)
        .select('id')
        .single();
      if (insertErr) {
        errors++;
        onProduct?.({ rowIndex: first.rowIndex, name: first.name, status: 'error', error: insertErr.message });
        continue;
      }
      productId = inserted.id;
      created++;
    }

    const imageUrls: string[] = [];
    if (first.images?.length) {
      for (const f of first.images) {
        const url = imageUrlMap.get(f) ?? imageUrlMap.get(f.toLowerCase().trim());
        if (url) imageUrls.push(url);
      }
    }
    if (productId && imageUrls.length > 0) {
      if (!updateExisting) {
        await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
      }
      const existingPositions = updateExisting
        ? ((await supabaseAdmin.from('product_images').select('position').eq('product_id', productId).order('position', { ascending: false }).limit(1)).data?.[0]?.position ?? -1)
        : -1;
      const startPos = existingPositions + 1;
      await supabaseAdmin.from('product_images').insert(
        imageUrls.map((url, pos) => ({
          product_id: productId,
          url,
          position: startPos + pos,
          alt_text: first.name,
        }))
      );
    }

    if (hasVariants && productId) {
      if (!updateExisting) {
        await supabaseAdmin.from('product_variants').delete().eq('product_id', productId);
      }
      for (const r of group) {
        const hasVariantData = r.variant_color || r.variant_size || r.variant_price !== undefined || (r.variant_stock !== undefined && r.variant_stock >= 0);
        if (!hasVariantData) continue;

        const size = r.variant_size?.trim() || null;
        const color = r.variant_color?.trim() || null;
        const variantName = size || color || 'Default';
        const colorHex = resolveColorHex(r.variant_color, r.variant_color_hex);

        const variantPayload = {
          product_id: productId,
          name: variantName,
          sku: null,
          price: r.variant_price ?? r.price,
          quantity: r.variant_stock ?? 0,
          option1: size,
          option2: color,
          metadata: colorHex ? { color_hex: colorHex } : {},
        };
        const { error: varErr } = await supabaseAdmin.from('product_variants').insert(variantPayload);
        if (!varErr) variantsCreated++;
      }
    }

    onProduct?.({
      rowIndex: first.rowIndex,
      name: first.name,
      status: 'success',
      productId: productId ?? undefined,
    });
  }

  return { created, variants: variantsCreated, errors, skipped };
}
