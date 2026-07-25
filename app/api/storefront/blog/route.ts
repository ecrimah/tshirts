import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT id, title, slug, excerpt, featured_image, published_at, tags, seo_title, seo_description
       FROM blog_posts
       WHERE status = 'published'::blog_status
       ORDER BY published_at DESC NULLS LAST, created_at DESC`
    );
    return NextResponse.json(result.rows, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[storefront/blog]', err);
    return NextResponse.json({ error: 'Failed to list posts' }, { status: 500 });
  }
}
