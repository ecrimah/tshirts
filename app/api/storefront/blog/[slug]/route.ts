import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  try {
    const row = await queryOne(
      `SELECT id, title, slug, excerpt, content, featured_image, published_at, tags, seo_title, seo_description
       FROM blog_posts
       WHERE (slug = $1 OR id::text = $1) AND status = 'published'::blog_status
       LIMIT 1`,
      [slug]
    );
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[storefront/blog/[slug]]', err);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
}
