import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const row = await queryOne<{
      products_total: string;
      products_active: string;
      orders_total: string;
      orders_pending: string;
      customers_total: string;
      revenue_paid: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM products)::text AS products_total,
        (SELECT COUNT(*) FROM products WHERE status = 'active')::text AS products_active,
        (SELECT COUNT(*) FROM orders)::text AS orders_total,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending')::text AS orders_pending,
        (SELECT COUNT(*) FROM customers)::text AS customers_total,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid')::text AS revenue_paid
    `);

    return NextResponse.json({
      products: {
        total: Number(row?.products_total || 0),
        active: Number(row?.products_active || 0),
      },
      orders: {
        total: Number(row?.orders_total || 0),
        pending: Number(row?.orders_pending || 0),
      },
      customers: Number(row?.customers_total || 0),
      revenue_paid: Number(row?.revenue_paid || 0),
    });
  } catch (err: unknown) {
    console.error('[admin/stats]', err);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
