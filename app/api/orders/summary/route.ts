import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyAuth, isStaffRole } from '@/lib/auth';

const PII_METADATA_KEYS = new Set([
  'first_name',
  'last_name',
  'full_name',
  'email',
  'phone',
  'shipping_address',
  'billing_address',
  'customer_name',
  'customer_email',
  'customer_phone',
]);

function stripPersonalMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== 'object') return metadata ?? null;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!PII_METADATA_KEYS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

function redactOrderSummary(order: Record<string, unknown>) {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    total: order.total,
    subtotal: order.subtotal,
    shipping_total: order.shipping_total,
    tax_total: order.tax_total,
    currency: order.currency,
    created_at: order.created_at,
    metadata: stripPersonalMetadata(order.metadata as Record<string, unknown> | null),
    order_items: order.order_items,
  };
}

/** Public order summary by order number (storefront success / pay pages). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('order_number') || url.searchParams.get('order');
  const emailHint = url.searchParams.get('email')?.trim().toLowerCase();

  if (!ref) {
    return NextResponse.json({ error: 'order_number required' }, { status: 400 });
  }

  try {
    const auth = await verifyAuth(request);
    const isStaff = auth.authenticated && isStaffRole(auth.role || '');

    const order = await queryOne(
      `SELECT id, order_number, status, payment_status, total, subtotal, shipping_total,
              tax_total, currency, created_at, email, phone, shipping_address, metadata,
        COALESCE(
          (SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at)
           FROM order_items oi WHERE oi.order_id = o.id),
          '[]'::jsonb
        ) AS order_items
       FROM orders o WHERE o.order_number = $1 OR o.id::text = $1`,
      [ref]
    );

    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const emailMatches =
      emailHint != null && String(order.email || '').toLowerCase() === emailHint;

    if (isStaff || emailMatches) {
      return NextResponse.json(order);
    }

    return NextResponse.json(redactOrderSummary(order as Record<string, unknown>));
  } catch (err: unknown) {
    console.error('[orders/summary]', err);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}
