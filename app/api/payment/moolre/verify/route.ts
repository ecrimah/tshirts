import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { resolveMoolreExternalRefForOrder, verifyMoolrePayment } from '@/lib/payment/moolre';
import { getChargeAmountForOrder } from '@/lib/payment/plan';

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  status: string;
  total: number;
  email: string;
  phone: string | null;
  shipping_address: unknown;
  metadata: Record<string, unknown> | null;
};

type OrderJson = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`verify:${clientId}`, RATE_LIMITS.payment);

    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
    }

    const { orderNumber } = await req.json();

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json({ success: false, message: 'Missing or invalid orderNumber' }, { status: 400 });
    }

    if (!/^ORD-\d+-\d+$/.test(orderNumber)) {
      return NextResponse.json({ success: false, message: 'Invalid order number format' }, { status: 400 });
    }

    const order = await queryOne<OrderRow>(
      `SELECT id, order_number, payment_status::text AS payment_status, status::text AS status,
              total, email, phone, shipping_address, metadata
       FROM orders WHERE order_number = $1`,
      [orderNumber]
    );

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        status: order.status,
        payment_status: order.payment_status,
        message: 'Order already paid',
      });
    }

    const meta = order.metadata || {};
    if (meta.payment_method && meta.payment_method !== 'moolre') {
      return NextResponse.json({
        success: false,
        message: 'This order does not use Moolre payment',
      }, { status: 400 });
    }

    if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY) {
      return NextResponse.json({
        success: false,
        status: order.status,
        payment_status: order.payment_status,
        message: 'Payment verification unavailable',
      }, { status: 503 });
    }

    const expectedCharge = getChargeAmountForOrder(order);
    const externalRef = await resolveMoolreExternalRefForOrder(orderNumber);
    const apiCheck = await verifyMoolrePayment(externalRef, expectedCharge);

    if (!apiCheck.verified) {
      return NextResponse.json({
        success: false,
        status: order.status,
        payment_status: order.payment_status,
        message: 'Payment not yet confirmed by payment provider',
      });
    }

    const chargedAmount = apiCheck.amount ?? expectedCharge;
    const prevStatus = order.payment_status;
    const wasAlreadyConfirmed = meta.confirmation_sent_at;
    const paidRow = await queryOne<{ result: OrderJson }>(
      `SELECT record_order_payment($1, $2, $3) AS result`,
      [orderNumber, externalRef, chargedAmount]
    );
    const orderJson = paidRow?.result;

    if (!orderJson) {
      return NextResponse.json({ success: false, message: 'Failed to update order' }, { status: 500 });
    }

    if (orderJson.payment_status === 'paid' && orderJson.email && prevStatus !== 'paid') {
      try {
        await query(`SELECT update_customer_stats($1, $2)`, [
          String(orderJson.email),
          Number(orderJson.total),
        ]);
      } catch (statsError: unknown) {
        console.error('[Verify] Customer stats failed:', statsError);
      }
    }

    if (
      !wasAlreadyConfirmed &&
      (orderJson.payment_status === 'paid' || orderJson.payment_status === 'partially_paid')
    ) {
      try {
        await sendOrderConfirmation(orderJson);
        await query(
          `UPDATE orders SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE order_number = $1`,
          [orderNumber, JSON.stringify({ confirmation_sent_at: new Date().toISOString() })]
        );
      } catch (notifyError: unknown) {
        console.error('[Verify] Notification failed:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      status: orderJson.status || 'processing',
      payment_status: orderJson.payment_status,
      message:
        orderJson.payment_status === 'partially_paid'
          ? 'Deposit verified. Remaining balance is due before pickup or delivery.'
          : 'Payment verified and order updated',
      balance_due: (orderJson.metadata as Record<string, unknown> | undefined)?.balance_due ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[Verify] Error:', message);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
