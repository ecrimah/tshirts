import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/data/products';

let cache: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get('featured') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const category = searchParams.get('category');

  const cacheKey = `${featured}-${limit}-${category || 'all'}`;

  if (featured && cache?.data?.[cacheKey] && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data[cacheKey], {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    const data = await listProducts({
      featured: featured || undefined,
      limit,
      categorySlug: category,
      status: 'active',
    });

    if (!cache) cache = { data: {}, timestamp: Date.now() };
    cache.data[cacheKey] = data;
    cache.timestamp = Date.now();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    console.error('[Storefront API] Products error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
