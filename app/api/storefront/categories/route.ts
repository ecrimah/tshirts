import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/data/products';

export async function GET() {
  try {
    const data = await listCategories(true);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    });
  } catch (err: unknown) {
    console.error('[Storefront API] Categories error:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
