import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  applySafeReconciliation,
  checkOrderAgainstGateway,
  listReconcileCandidates,
  listReconcileLogs,
  writeReconcileLog,
} from '@/lib/payment/reconcile';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const olderThanMinutes = parseInt(url.searchParams.get('olderThanMinutes') || '15', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const includeLogs = url.searchParams.get('logs') !== '0';

    let candidates;
    try {
      candidates = await listReconcileCandidates({ olderThanMinutes, limit });
    } catch (scanErr: unknown) {
      console.error('[reconcile GET] scan failed:', scanErr);
      return NextResponse.json({ error: 'Failed to load reconciliation queue' }, { status: 500 });
    }

    const logs = includeLogs ? await listReconcileLogs(25) : [];

    return NextResponse.json({
      candidates,
      logs,
      scanned_at: new Date().toISOString(),
      olderThanMinutes,
    });
  } catch (err: unknown) {
    console.error('[reconcile GET]', err);
    return NextResponse.json({ error: 'Failed to load reconciliation queue' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action as string;
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() : '';

    if (!orderNumber || !/^ORD-\d+-\d+$/.test(orderNumber)) {
      return NextResponse.json({ error: 'Valid orderNumber required' }, { status: 400 });
    }

    if (action === 'check') {
      const check = await checkOrderAgainstGateway(orderNumber);
      if (!check) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      await writeReconcileLog({
        orderNumber,
        action: 'check',
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
        result: check.safe_to_apply ? 'actionable' : 'reviewed',
        details: {
          issue: check.issue,
          gateway: check.gateway,
          proposed_action: check.proposed_action,
          proposed_label: check.proposed_label,
        },
      });

      return NextResponse.json({ success: true, check });
    }

    if (action === 'apply') {
      const result = await applySafeReconciliation({
        orderNumber,
        adminUserId: auth.user.id,
        adminEmail: auth.user.email,
      });

      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message, check: result.check },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        payment_status: result.payment_status,
        check: result.check,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use check or apply.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('[reconcile POST]', err);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
