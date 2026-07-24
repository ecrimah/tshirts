import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function firstImageUrl(rows: { url: string | null; position: number | null }[] | null): string | null {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.url || null;
}

type SearchRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  compare_at_price: number | null;
  category_name: string | null;
  product_images: { url: string | null; position: number | null }[] | null;
};

async function fetchProducts(pattern: string, limit: number, prefix: boolean) {
  const op = prefix ? `${pattern}%` : `%${pattern}%`;
  const result = await query<SearchRow>(
    `
    SELECT DISTINCT ON (p.id)
      p.id, p.name, p.slug, p.price, p.sale_price, p.compare_at_price,
      c.name AS category_name,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'position', pi.position) ORDER BY pi.position)
         FROM product_images pi WHERE pi.product_id = p.id),
        '[]'::jsonb
      ) AS product_images
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'active'::product_status
      AND (p.name ILIKE $1 ESCAPE '\\' OR p.slug ILIKE $1 ESCAPE '\\')
    ORDER BY p.id, p.name ASC
    LIMIT $2
    `,
    [op, limit]
  );

  return result.rows.sort((a, b) => String(a.name).localeCompare(String(b.name))).slice(0, limit);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10) || 12, 1), 30);

  if (raw.length < 1) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  }

  try {
    const q = escapeIlike(raw);
    let rows = await fetchProducts(q, limit, true);
    if (!rows.length && raw.length >= 2) {
      rows = await fetchProducts(q, limit, false);
    }

    const payload = rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      sale_price: p.sale_price,
      compare_at_price: p.compare_at_price,
      categoryName: p.category_name,
      image: firstImageUrl(
        Array.isArray(p.product_images)
          ? p.product_images
          : p.product_images
            ? (p.product_images as unknown as { url: string | null; position: number | null }[])
            : null
      ),
    }));

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (e: unknown) {
    console.error('[storefront/search]', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
