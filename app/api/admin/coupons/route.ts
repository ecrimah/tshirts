import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

const DISCOUNT_TYPES = ['percentage', 'fixed_amount', 'free_shipping'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

function isDiscountType(v: unknown): v is DiscountType {
  return typeof v === 'string' && (DISCOUNT_TYPES as readonly string[]).includes(v);
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await query(`SELECT * FROM coupons ORDER BY created_at DESC`);
    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    console.error('[admin/coupons GET]', err);
    return NextResponse.json({ error: 'Failed to list coupons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    code,
    description,
    type,
    value,
    minimum_purchase = 0,
    maximum_discount = null,
    usage_limit = null,
    per_user_limit = 1,
    start_date = null,
    end_date = null,
    is_active = true,
    metadata = {},
  } = body;

  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }
  if (!isDiscountType(type)) {
    return NextResponse.json({ error: 'type must be percentage, fixed_amount, or free_shipping' }, { status: 400 });
  }
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 });
  }

  const normalizedCode = code.trim().toUpperCase();

  try {
    const created = await queryOne(
      `INSERT INTO coupons (
        code, description, type, value, minimum_purchase, maximum_discount,
        usage_limit, per_user_limit, start_date, end_date, is_active, metadata
      ) VALUES (
        $1, $2, $3::discount_type, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
      ) RETURNING *`,
      [
        normalizedCode,
        description || null,
        type,
        Number(value),
        Number(minimum_purchase) || 0,
        maximum_discount != null && maximum_discount !== '' ? Number(maximum_discount) : null,
        usage_limit != null && usage_limit !== '' ? Number(usage_limit) : null,
        per_user_limit != null ? Number(per_user_limit) : 1,
        start_date || null,
        end_date || null,
        Boolean(is_active),
        JSON.stringify(metadata),
      ]
    );
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create failed';
    if (message.includes('coupons_code_key') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
    }
    console.error('[admin/coupons POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
