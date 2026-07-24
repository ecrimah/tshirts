import { NextResponse } from 'next/server';
import { trackOrder } from '@/lib/data/orders';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();
    const order_number = String(body.order_number || body.orderNumber || '').trim();

    if (!email || !order_number) {
      return NextResponse.json({ error: 'email and order_number are required' }, { status: 400 });
    }

    const order = await trackOrder(email, order_number);
    if (!order) {
      return NextResponse.json({ error: 'Order not found or email does not match' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err: unknown) {
    console.error('[orders/track]', err);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}
