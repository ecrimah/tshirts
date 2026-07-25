import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { slugifyProduct } from '@/lib/product-seo';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const params: unknown[] = [];
  let where = '';
  if (status && status !== 'all') {
    params.push(status);
    where = `WHERE status = $1::blog_status`;
  }

  try {
    const result = await query(
      `SELECT id, title, slug, excerpt, featured_image, status, published_at, created_at, updated_at, tags, seo_title
       FROM blog_posts
       ${where}
       ORDER BY coalesce(published_at, created_at) DESC`,
      params
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('[admin/blog GET]', err);
    return NextResponse.json({ error: 'Failed to list posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const content = String(body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    let slug = String(body.slug || slugifyProduct(title)).trim();
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const existing = await queryOne(`SELECT id FROM blog_posts WHERE slug = $1`, [slug]);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const status = body.status || 'draft';
    const tags = Array.isArray(body.tags) ? body.tags : [];
    const publishedAt =
      status === 'published' ? body.published_at || new Date().toISOString() : null;

    const created = await queryOne(
      `INSERT INTO blog_posts (
         title, slug, excerpt, content, featured_image, author_id, status,
         published_at, seo_title, seo_description, tags
       ) VALUES (
         $1, $2, $3, $4, $5, $6::uuid, $7::blog_status,
         $8::timestamptz, $9, $10, $11::text[]
       ) RETURNING *`,
      [
        title,
        slug,
        body.excerpt || null,
        content,
        body.featured_image || null,
        auth.user?.id || null,
        status,
        publishedAt,
        body.seo_title || title.slice(0, 60),
        body.seo_description || null,
        tags,
      ]
    );

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    console.error('[admin/blog POST]', err);
    const message = err instanceof Error ? err.message : 'Create failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
