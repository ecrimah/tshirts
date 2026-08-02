import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import {
  assertCallbackSecretConfigured,
  callbackIndicatesSuccess,
  extractOrderRefFromCallback,
  resolveMoolreExternalRefForOrder,
  validateCallbackSecret,
  verifyMoolrePayment,
} from '@/lib/payment/moolre';
import { getChargeAmountForOrder } from '@/lib/payment/plan';

type OrderJson = Record<string, unknown> & {
  id?: string;
  order_number?: string;
  email?: string;
  total?: number;
  payment_status?: string;
  metadata?: Record<string, unknown> | null;
};

async function recordPayment(
  orderRef: string,
  moolreRef: string,
  chargedAmount: number
): Promise<OrderJson | null> {
  const row = await queryOne<{ result: OrderJson }>(
    `SELECT record_order_payment($1, $2, $3) AS result`,
    [orderRef, moolreRef, chargedAmount]
  );
  return row?.result ?? null;
}

export async function POST(req: Request) {
  try {
    assertCallbackSecretConfigured();
  } catch (configErr) {
    console.error('[Callback]', configErr);
    return NextResponse.json({ success: false, message: 'Payment callback not configured' }, { status: 503 });
  }

  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`callback:${clientId}`, RATE_LIMITS.callback);

    if (!rateLimitResult.success) {
      return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
    }

    let body: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else if (contentType.includes('form')) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries()) as Record<string, unknown>;
      } else {
        const rawText = await req.text();
        try {
          body = JSON.parse(rawText);
        } catch {
          body = Object.fromEntries(new URLSearchParams(rawText).entries()) as Record<string, unknown>;
        }
      }
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid Request Body' }, { status: 400 });
    }

    if (!validateCallbackSecret(body)) {
      return NextResponse.json({ success: false, message: 'Invalid callback signature' }, { status: 403 });
    }

    const { merchantOrderRef, moolreReference, rawExternalRef } = extractOrderRefFromCallback(body);

    if (!merchantOrderRef) {
      return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
    }

    const isSuccess = callbackIndicatesSuccess(body);

    if (isSuccess) {
      const existingOrder = await queryOne<{
        id: string;
        payment_status: string;
        total: number;
        metadata: Record<string, unknown> | null;
      }>(
        `SELECT id, payment_status::text AS payment_status, total, metadata FROM orders WHERE order_number = $1`,
        [merchantOrderRef]
      );

      if (!existingOrder) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
      }

      if (existingOrder.payment_status === 'paid') {
        return NextResponse.json({ success: true, message: 'Order already processed' });
      }

      const expectedCharge = getChargeAmountForOrder(existingOrder);

      const externalRef =
        rawExternalRef ||
        String(existingOrder.metadata?.moolre_externalref || '') ||
        (await resolveMoolreExternalRefForOrder(merchantOrderRef));

      const apiCheck = await verifyMoolrePayment(externalRef, expectedCharge);
      if (!apiCheck.verified) {
        return NextResponse.json(
          { success: false, message: 'Payment could not be verified with provider' },
          { status: 400 }
        );
      }

      const chargedAmount = apiCheck.amount ?? expectedCharge;
      const prevStatus = existingOrder.payment_status;
      const wasConfirmed = existingOrder.metadata?.confirmation_sent_at;

      // Deduplicate already-processed gateway references
      if (moolreReference) {
        const prior = await queryOne<{ id: string }>(
          `SELECT id FROM payment_callback_events
           WHERE gateway = 'moolre' AND gateway_reference = $1 AND processing_status = 'processed'
           LIMIT 1`,
          [moolreReference]
        );
        if (prior) {
          return NextResponse.json({ success: true, message: 'Callback already processed' });
        }
      }

      const orderJson = await recordPayment(merchantOrderRef, moolreReference, chargedAmount);
      if (!orderJson?.id) {
        return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
      }

      try {
        await query(
          `INSERT INTO payment_callback_events
             (gateway, order_number, external_ref, gateway_reference, event_type, processing_status, amount, currency, details, processed_at)
           VALUES
             ('moolre', $1, $2, $3, 'callback', 'processed', $4, 'GHS', $5::jsonb, now())`,
          [
            merchantOrderRef,
            externalRef || null,
            moolreReference || null,
            chargedAmount,
            JSON.stringify({ payment_status: orderJson.payment_status }),
          ]
        );
      } catch (eventErr: unknown) {
        console.error('[Callback] event log failed:', eventErr);
      }

      if (orderJson.payment_status === 'paid' && orderJson.email && prevStatus !== 'paid') {
        try {
          await query(`SELECT update_customer_stats($1, $2)`, [
            String(orderJson.email),
            Number(orderJson.total),
          ]);
        } catch (statsError: unknown) {
          console.error('[Callback] Customer stats failed:', statsError);
        }
      }

      if (!wasConfirmed && (orderJson.payment_status === 'paid' || orderJson.payment_status === 'partially_paid')) {
        try {
          await sendOrderConfirmation(orderJson);
          await query(
            `UPDATE orders SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE order_number = $1`,
            [merchantOrderRef, JSON.stringify({ confirmation_sent_at: new Date().toISOString() })]
          );
        } catch (notifyError: unknown) {
          console.error('[Callback] Notification failed:', notifyError);
        }
      }

      return NextResponse.json({
        success: true,
        message:
          orderJson.payment_status === 'partially_paid'
            ? 'Deposit verified; balance due before pickup/delivery'
            : 'Payment verified and Order Updated',
        payment_status: orderJson.payment_status,
      });
    }

    await query(
      `UPDATE orders SET payment_status = 'failed'::payment_status,
       metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE order_number = $1 AND payment_status IN ('pending'::payment_status, 'failed'::payment_status)`,
      [
        merchantOrderRef,
        JSON.stringify({
          moolre_reference: moolreReference,
          failure_reason: body.message || 'Payment failed',
        }),
      ]
    );

    return NextResponse.json({ success: false, message: 'Payment not successful' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Callback] Critical Error:', message);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Moolre callback endpoint ready', timestamp: new Date().toISOString() });
}
