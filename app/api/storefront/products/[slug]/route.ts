import { NextResponse } from 'next/server';
import { getProductBySlug } from '@/lib/data/products';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  try {
    const product = await getProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(product, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err: unknown) {
    console.error('[storefront/products/slug]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
