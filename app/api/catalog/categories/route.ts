import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { listCategories } from '@/lib/data/products';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  const all = auth.authenticated;
  try {
    const rows = await listCategories(!all);
    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error('[catalog/categories GET]', err);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug, description, image_url, status = 'active', position = 0, metadata = {} } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  try {
    const created = await queryOne(
      `INSERT INTO categories (name, slug, description, image_url, status, position, metadata)
       VALUES ($1, $2, $3, $4, $5::category_status, $6, $7::jsonb)
       RETURNING *`,
      [name, slug, description || null, image_url || null, status, position, JSON.stringify(metadata)]
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
