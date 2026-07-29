import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendPaymentLink } from '@/lib/notifications';
import { isProductionEnv } from '@/lib/payment/moolre';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (isProductionEnv() && !cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const pending = await query<{
      id: string;
      order_number: string;
      email: string;
      phone: string | null;
      total: number;
      shipping_address: unknown;
      metadata: unknown;
    }>(
      `SELECT id, order_number, email, phone, total, shipping_address, metadata
       FROM orders
       WHERE payment_status <> 'paid'::payment_status
         AND payment_reminder_sent = false
         AND created_at < $1::timestamptz
       ORDER BY created_at ASC
       LIMIT 50`,
      [fifteenMinutesAgo]
    );

    if (!pending.rows.length) {
      return NextResponse.json({
        success: true,
        message: 'No pending reminders to send',
        processed: 0,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const order of pending.rows) {
      try {
        await sendPaymentLink(order);
        await query(
          `UPDATE orders SET payment_reminder_sent = true, payment_reminder_sent_at = now() WHERE id = $1`,
          [order.id]
        );
        sent++;
      } catch (err) {
        console.error(`[Payment Reminders] Failed for order ${order.order_number}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${pending.rows.length} orders`,
      sent,
      failed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Cron failed';
    console.error('[Payment Reminders] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
