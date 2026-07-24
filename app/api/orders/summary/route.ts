import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

/** Public order summary by order number (storefront success / pay pages). */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('order_number')
    || new URL(request.url).searchParams.get('order');
  if (!ref) {
    return NextResponse.json({ error: 'order_number required' }, { status: 400 });
  }

  try {
    const order = await queryOne(
      `SELECT id, order_number, status, payment_status, total, subtotal, shipping_total,
              tax_total, currency, created_at, metadata,
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

    return NextResponse.json(order);
  } catch (err: unknown) {
    console.error('[orders/summary]', err);
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
  }
}
