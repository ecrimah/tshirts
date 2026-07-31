import { NextResponse } from 'next/server';
import { verifyAuth, isStaffRole } from '@/lib/auth';
import {
  createOrderFromCheckout,
  listOrdersAdmin,
  listOrdersForUser,
  getUserIdFromRequest,
} from '@/lib/data/orders';

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request);
    const userId = await getUserIdFromRequest(request);

    if (auth.authenticated && auth.user && isStaffRole(auth.role || auth.user.role)) {
      const orders = await listOrdersAdmin();
      return NextResponse.json(orders);
    }

    if (userId) {
      const orders = await listOrdersForUser(userId);
      return NextResponse.json(orders);
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (err: unknown) {
    console.error('[orders GET]', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orderNumber,
      trackingNumber,
      shippingData,
      deliveryMethod = 'pickup',
      paymentMethod = 'moolre',
      paymentOption = 'full',
      cart,
      shippingCost = 0,
      tax = 0,
    } = body;

    if (!orderNumber || !trackingNumber || !shippingData || !Array.isArray(cart) || !cart.length) {
      return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
    }

    if (paymentOption !== 'full' && paymentOption !== 'half') {
      return NextResponse.json({ error: 'Invalid payment option' }, { status: 400 });
    }

    const userId = await getUserIdFromRequest(request);

    const order = await createOrderFromCheckout({
      userId,
      orderNumber,
      trackingNumber,
      shippingData,
      deliveryMethod,
      paymentMethod,
      paymentOption,
      cart,
      shippingCost,
      tax,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    console.error('[orders POST]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
