import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

const DISCOUNT_TYPES = ['percentage', 'fixed_amount', 'free_shipping'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

type Ctx = { params: Promise<{ id: string }> };

const PATCH_FIELDS = [
  'code',
  'description',
  'type',
  'value',
  'minimum_purchase',
  'maximum_discount',
  'usage_limit',
  'per_user_limit',
  'start_date',
  'end_date',
  'is_active',
  'metadata',
] as const;

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

  for (const key of PATCH_FIELDS) {
    if (!(key in body)) continue;

    if (key === 'type') {
      const t = body.type;
      if (!(DISCOUNT_TYPES as readonly string[]).includes(t)) {
        return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 });
      }
      sets.push(`type = $${i}::discount_type`);
      params.push(t as DiscountType);
    } else if (key === 'code') {
      const code = body.code;
      if (typeof code !== 'string' || !code.trim()) {
        return NextResponse.json({ error: 'code cannot be empty' }, { status: 400 });
      }
      sets.push(`code = $${i}`);
      params.push(code.trim().toUpperCase());
    } else if (key === 'metadata') {
      sets.push(`metadata = $${i}::jsonb`);
      params.push(JSON.stringify(body.metadata ?? {}));
    } else if (key === 'maximum_discount' || key === 'usage_limit') {
      const v = body[key];
      sets.push(`${key} = $${i}`);
      params.push(v != null && v !== '' ? Number(v) : null);
    } else if (key === 'value' || key === 'minimum_purchase' || key === 'per_user_limit') {
      sets.push(`${key} = $${i}`);
      params.push(Number(body[key]));
    } else if (key === 'is_active') {
      sets.push(`is_active = $${i}`);
      params.push(Boolean(body[key]));
    } else if (key === 'start_date' || key === 'end_date') {
      sets.push(`${key} = $${i}`);
      params.push(body[key] || null);
    } else {
      sets.push(`${key} = $${i}`);
      params.push(body[key] ?? null);
    }
    i++;
  }

  if (!sets.length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  sets.push('updated_at = now()');

  try {
    const row = await queryOne(
      `UPDATE coupons SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`,
      params
    );
    if (!row) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('coupons_code_key') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
    }
    console.error('[admin/coupons PATCH]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await query(`DELETE FROM coupons WHERE id = $1::uuid RETURNING id`, [id]);
    if (!result.rowCount) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[admin/coupons DELETE]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
