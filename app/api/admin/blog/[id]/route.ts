import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { slugifyProduct } from '@/lib/product-seo';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const row = await queryOne(`SELECT * FROM blog_posts WHERE id = $1::uuid`, [id]);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (err) {
    console.error('[admin/blog/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = await request.json();
    const existing = await queryOne<{ id: string; status: string; published_at: string | null }>(
      `SELECT id, status, published_at FROM blog_posts WHERE id = $1::uuid`,
      [id]
    );
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const title = body.title !== undefined ? String(body.title).trim() : undefined;
    const content = body.content !== undefined ? String(body.content).trim() : undefined;
    let slug =
      body.slug !== undefined
        ? String(body.slug || (title ? slugifyProduct(title) : '')).trim()
        : undefined;

    if (slug) {
      const clash = await queryOne(
        `SELECT id FROM blog_posts WHERE slug = $1 AND id <> $2::uuid`,
        [slug, id]
      );
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    }

    const status = body.status;
    let publishedAt = body.published_at;
    if (status === 'published') {
      if (existing.status === 'published' && existing.published_at) {
        publishedAt = existing.published_at;
      } else {
        publishedAt = publishedAt || new Date().toISOString();
      }
    } else if (status && status !== 'published') {
      publishedAt = null;
    }

    const updated = await queryOne(
      `UPDATE blog_posts SET
         title = COALESCE($2, title),
         slug = COALESCE($3, slug),
         excerpt = CASE WHEN $4::boolean THEN $5 ELSE excerpt END,
         content = COALESCE($6, content),
         featured_image = CASE WHEN $7::boolean THEN $8 ELSE featured_image END,
         status = COALESCE($9::blog_status, status),
         published_at = CASE WHEN $10::boolean THEN $11::timestamptz ELSE published_at END,
         seo_title = CASE WHEN $12::boolean THEN $13 ELSE seo_title END,
         seo_description = CASE WHEN $14::boolean THEN $15 ELSE seo_description END,
         tags = CASE WHEN $16::boolean THEN $17::text[] ELSE tags END,
         updated_at = now()
       WHERE id = $1::uuid
       RETURNING *`,
      [
        id,
        title ?? null,
        slug ?? null,
        body.excerpt !== undefined,
        body.excerpt ?? null,
        content ?? null,
        body.featured_image !== undefined,
        body.featured_image ?? null,
        status ?? null,
        status !== undefined || body.published_at !== undefined,
        publishedAt,
        body.seo_title !== undefined,
        body.seo_title ?? null,
        body.seo_description !== undefined,
        body.seo_description ?? null,
        body.tags !== undefined,
        Array.isArray(body.tags) ? body.tags : [],
      ]
    );

    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error('[admin/blog/[id] PATCH]', err);
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const result = await query(`DELETE FROM blog_posts WHERE id = $1::uuid RETURNING id`, [id]);
    if (!result.rowCount) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
