import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');
  const slug = searchParams.get('slug');
  const status = searchParams.get('status') || 'approved';

  if (!productId && !slug) {
    return NextResponse.json({ error: 'product_id or slug required' }, { status: 400 });
  }

  try {
    let pid = productId;
    if (!pid && slug) {
      const p = await queryOne<{ id: string }>(`SELECT id FROM products WHERE slug = $1`, [slug]);
      pid = p?.id ?? null;
    }
    if (!pid) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const result = await query(
      `SELECT r.*, pr.full_name AS profile_name
       FROM reviews r
       LEFT JOIN profiles pr ON pr.id = r.user_id
       WHERE r.product_id = $1::uuid AND r.status = $2::review_status
       ORDER BY r.created_at DESC`,
      [pid, status]
    );

    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    console.error('[reviews GET]', err);
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Login required to leave a review' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, rating, title, content } = body;

    if (!product_id || !rating || !content) {
      return NextResponse.json({ error: 'product_id, rating, and content are required' }, { status: 400 });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 });
    }

    const created = await queryOne(
      `INSERT INTO reviews (product_id, user_id, rating, title, content, status)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'pending'::review_status)
       RETURNING *`,
      [product_id, auth.user.id, numericRating, title || null, content]
    );

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create failed';
    console.error('[reviews POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
