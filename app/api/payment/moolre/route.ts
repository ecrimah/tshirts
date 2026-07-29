import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

type OrderRow = {
  id: string;
  order_number: string;
  total: number;
  email: string;
  payment_status: string;
};

export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetIn.toString(),
          },
        }
      );
    }

    const body = await req.json();
    const { orderId, customerEmail } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
    }

    if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
      console.error('Missing Moolre credentials');
      return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
    }

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    const order = await queryOne<OrderRow>(
      isUUID
        ? `SELECT id, order_number, total, email, payment_status::text AS payment_status
           FROM orders WHERE id = $1::uuid OR order_number = $1::text LIMIT 1`
        : `SELECT id, order_number, total, email, payment_status::text AS payment_status
           FROM orders WHERE order_number = $1::text LIMIT 1`,
      [orderId]
    );

    if (!order) {
      console.error('[Payment] Order not found:', orderId);
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
    }

    const amount = Number(order.total);
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
    }

    const orderRef = order.order_number || orderId;
    const requestUrl = new URL(req.url);
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin).replace(/\/+$/, '');
    const uniqueRef = `${orderRef}-R${Date.now()}`;

    const payload = {
      type: 1,
      amount: amount.toString(),
      email: process.env.MOOLRE_MERCHANT_EMAIL || 'admin@mamator.com',
      externalref: uniqueRef,
      callback: `${baseUrl}/api/payment/moolre/callback`,
      redirect: `${baseUrl}/order-success?order=${orderRef}&payment_success=true`,
      reusable: '0',
      currency: 'GHS',
      accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
      metadata: {
        customer_email: customerEmail || order.email,
        original_order_number: orderRef,
      },
    };

    const response = await fetch('https://api.moolre.com/embed/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-USER': process.env.MOOLRE_API_USER,
        'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const result = await response.json();

    if (result.status === 1 && result.data?.authorization_url) {
      await query(
        `UPDATE orders SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $1::uuid`,
        [
          order.id,
          JSON.stringify({
            moolre_externalref: uniqueRef,
            moolre_reference: result.data.reference || uniqueRef,
            payment_link_created_at: new Date().toISOString(),
          }),
        ]
      );

      return NextResponse.json({
        success: true,
        url: result.data.authorization_url,
        reference: result.data.reference,
      });
    }

    return NextResponse.json(
      { success: false, message: result.message || 'Failed to generate payment link' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Payment API Error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
