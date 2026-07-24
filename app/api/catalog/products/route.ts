import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { syncProductMedia } from '@/lib/data/catalog-sync';

const PRODUCT_SELECT = `
  p.*,
  CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END AS categories,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'alt_text', pi.alt_text) ORDER BY pi.position)
     FROM product_images pi WHERE pi.product_id = p.id),
    '[]'::jsonb
  ) AS product_images,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'name', pv.name, 'price', pv.price, 'sale_price', pv.sale_price, 'quantity', pv.quantity))
     FROM product_variants pv WHERE pv.product_id = p.id),
    '[]'::jsonb
  ) AS product_variants,
  (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id) AS variants_count
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('q')?.trim();

  const auth = await verifyAuth(request, { requireAdmin: true });
  const isStaff = auth.authenticated && (auth.role === 'admin' || auth.role === 'staff');

  if (status && status !== 'active' && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params: unknown[] = [];
  const where: string[] = [];

  const effectiveStatus = status || (isStaff ? null : 'active');
  if (effectiveStatus && effectiveStatus !== 'all') {
    params.push(effectiveStatus);
    where.push(`p.status = $${params.length}::product_status`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`);
  }

  let orderSql = 'p.created_at DESC';
  if (sort === 'price_asc') orderSql = 'p.price ASC';
  if (sort === 'price_desc') orderSql = 'p.price DESC';
  if (sort === 'name') orderSql = 'p.name ASC';
  if (sort === 'stock') orderSql = 'p.quantity ASC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const result = await query(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${orderSql}`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    console.error('[catalog/products GET]', err);
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      price,
      category_id,
      status = 'draft',
      description,
      short_description,
      quantity = 0,
      sale_price,
      compare_at_price,
      featured = false,
      metadata = {},
      sku,
    } = body;

    if (!name || !slug || price === undefined) {
      return NextResponse.json({ error: 'name, slug, and price are required' }, { status: 400 });
    }

    const created = await queryOne(
      `INSERT INTO products (name, slug, price, category_id, status, description, short_description, quantity, sale_price, compare_at_price, featured, metadata, sku)
       VALUES ($1, $2, $3, $4::uuid, $5::product_status, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
       RETURNING *`,
      [
        name,
        slug,
        price,
        category_id || null,
        status,
        description || null,
        short_description || null,
        quantity,
        sale_price ?? null,
        compare_at_price ?? null,
        featured,
        JSON.stringify(metadata),
        sku || null,
      ]
    );

    if (!created) {
      return NextResponse.json({ error: 'Create failed' }, { status: 500 });
    }

    if (body.images || body.variants) {
      await syncProductMedia(created.id as string, body.images, body.variants);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
