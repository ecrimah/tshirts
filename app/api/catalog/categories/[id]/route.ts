import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const sets: string[] = [];
  const params: unknown[] = [id];
  let i = 2;
  for (const key of ['name', 'slug', 'description', 'image_url', 'status', 'position', 'metadata'] as const) {
    if (key in body) {
      if (key === 'status') sets.push(`${key} = $${i}::category_status`);
      else if (key === 'metadata') {
        sets.push(`${key} = $${i}::jsonb`);
        params.push(JSON.stringify(body[key]));
      } else {
        sets.push(`${key} = $${i}`);
        params.push(body[key]);
      }
      i++;
    }
  }
  if (!sets.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  sets.push('updated_at = now()');
  const row = await queryOne(`UPDATE categories SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`, params);
  return NextResponse.json(row);
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  await query(`UPDATE products SET category_id = NULL WHERE category_id = $1::uuid`, [id]);
  await query(`DELETE FROM categories WHERE id = $1::uuid`, [id]);
  return NextResponse.json({ success: true });
}
