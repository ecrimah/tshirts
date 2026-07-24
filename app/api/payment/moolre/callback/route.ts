import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

type OrderJson = Record<string, unknown> & {
  id?: string;
  order_number?: string;
  email?: string;
  total?: number;
  payment_status?: string;
};

async function markOrderPaid(orderRef: string, moolreRef: string): Promise<OrderJson | null> {
  const row = await queryOne<{ result: OrderJson }>(
    `SELECT mark_order_paid($1, $2) AS result`,
    [orderRef, moolreRef]
  );
  return row?.result ?? null;
}

export async function POST(req: Request) {
  console.log('[Callback] POST received at', new Date().toISOString());

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

    const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
    if (expectedSecret) {
      if (!body.secret || body.secret !== expectedSecret) {
        return NextResponse.json({ success: false, message: 'Invalid callback signature' }, { status: 403 });
      }
    }

    const data = (body.data || {}) as Record<string, unknown>;
    const rawExternalRef =
      data.externalref ||
      data.external_reference ||
      data.orderRef ||
      body.externalref ||
      body.orderRef ||
      body.external_reference;

    const rawRefStr = rawExternalRef ? String(rawExternalRef) : '';
    const metadata = (data.metadata || body.metadata || {}) as Record<string, unknown>;
    const merchantOrderRef = rawRefStr
      ? rawRefStr.replace(/-R\d+$/, '')
      : String(metadata.original_order_number || '');

    const moolreReference = String(
      data.transactionid || data.thirdpartyref || body.reference || 'callback'
    );

    const apiStatus = body.status;
    const txStatus = data.txtstatus;
    const messageStr = String(body.message || '').toLowerCase();

    if (!merchantOrderRef) {
      return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
    }

    const apiOk = apiStatus === 1 || apiStatus === '1';
    const txOk = txStatus === 1 || txStatus === '1';
    const isSuccess = (apiOk || txOk) && !messageStr.includes('fail') && !messageStr.includes('error');

    if (isSuccess) {
      const existingOrder = await queryOne<{ id: string; payment_status: string; total: number }>(
        `SELECT id, payment_status::text AS payment_status, total FROM orders WHERE order_number = $1`,
        [merchantOrderRef]
      );

      if (!existingOrder) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
      }

      if (existingOrder.payment_status === 'paid') {
        return NextResponse.json({ success: true, message: 'Order already processed' });
      }

      const callbackAmount = data.amount
        ? parseFloat(String(data.amount))
        : body.amount
          ? parseFloat(String(body.amount))
          : null;
      if (callbackAmount !== null) {
        const expectedAmount = Number(existingOrder.total);
        if (Math.abs(callbackAmount - expectedAmount) > 0.01) {
          return NextResponse.json(
            { success: false, message: 'Payment amount does not match order total' },
            { status: 400 }
          );
        }
      }

      const orderJson = await markOrderPaid(merchantOrderRef, moolreReference);
      if (!orderJson?.id) {
        return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
      }

      if (orderJson.email) {
        try {
          await query(`SELECT update_customer_stats($1, $2)`, [
            String(orderJson.email),
            Number(orderJson.total),
          ]);
        } catch (statsError: unknown) {
          console.error('[Callback] Customer stats failed:', statsError);
        }
      }

      try {
        await sendOrderConfirmation(orderJson);
      } catch (notifyError: unknown) {
        console.error('[Callback] Notification failed:', notifyError);
      }

      return NextResponse.json({ success: true, message: 'Payment verified and Order Updated' });
    }

    await query(
      `UPDATE orders SET payment_status = 'failed'::payment_status,
       metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE order_number = $1`,
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
