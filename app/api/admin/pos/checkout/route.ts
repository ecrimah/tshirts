import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { createOrderFromCheckout } from '@/lib/data/orders';

/** In-store POS checkout (cash / immediate paid). */
export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { orderNumber, trackingNumber, shippingData, cart, paymentMethod = 'cash', markPaid = true, deliveryMethod = 'pickup' } = body;

  if (!orderNumber || !cart?.length || !shippingData?.email) {
    return NextResponse.json({ error: 'Invalid POS payload' }, { status: 400 });
  }

  const order = await createOrderFromCheckout({
    userId: auth.user?.id,
    orderNumber,
    trackingNumber: trackingNumber || `SLI-POS-${Date.now()}`,
    shippingData,
    deliveryMethod,
    paymentMethod,
    cart,
    shippingCost: 0,
    tax: 0,
  });

  if (markPaid) {
    await queryOne(`SELECT mark_order_paid($1, $2) AS result`, [order.order_number, 'pos-cash']);
    if (order.email) {
      await query(`SELECT update_customer_stats($1, $2)`, [order.email, order.total]);
    }
  }

  return NextResponse.json(order, { status: 201 });
}
