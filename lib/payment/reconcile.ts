import { query, queryOne } from '@/lib/db';
import { fetchMoolrePaymentStatus, resolveMoolreExternalRefForOrder } from '@/lib/payment/moolre';
import { getAmountPaid, getChargeAmountForOrder } from '@/lib/payment/plan';

export type ReconcileIssue =
  | 'stale_unpaid'
  | 'gateway_paid_local_unpaid'
  | 'amount_mismatch'
  | 'partial_balance_due'
  | 'missing_external_ref'
  | 'gateway_unpaid'
  | 'synced'
  | 'unknown';

export type ReconcileCandidate = {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  age_minutes: number;
  amount_paid: number;
  expected_charge: number;
  balance_due: number;
  external_ref: string | null;
  issue: ReconcileIssue;
  issue_label: string;
};

export type ReconcileCheckResult = ReconcileCandidate & {
  gateway: {
    verified: boolean;
    amount?: number;
    status?: string;
  };
  proposed_action: 'none' | 'apply_payment' | 'manual_review';
  proposed_label: string;
  safe_to_apply: boolean;
};

function money(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

function issueLabel(issue: ReconcileIssue): string {
  switch (issue) {
    case 'stale_unpaid':
      return 'Unpaid / failed — needs gateway check';
    case 'gateway_paid_local_unpaid':
      return 'Gateway paid, local order not updated';
    case 'amount_mismatch':
      return 'Gateway amount does not match expected charge';
    case 'partial_balance_due':
      return 'Half paid — balance still due';
    case 'missing_external_ref':
      return 'No Moolre payment reference on file';
    case 'gateway_unpaid':
      return 'Gateway still unpaid';
    case 'synced':
      return 'In sync';
    default:
      return 'Needs review';
  }
}

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  total: number;
  payment_status: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  age_minutes: number;
};

export async function listReconcileCandidates(options?: {
  olderThanMinutes?: number;
  limit?: number;
}): Promise<ReconcileCandidate[]> {
  const olderThan = Math.max(1, options?.olderThanMinutes ?? 15);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));

  const result = await query<OrderRow>(
    `SELECT id, order_number, email, total,
            payment_status::text AS payment_status,
            status::text AS status,
            created_at::text AS created_at,
            metadata,
            EXTRACT(EPOCH FROM (now() - created_at)) / 60 AS age_minutes
     FROM orders
     WHERE payment_status IN (
         'pending'::payment_status,
         'failed'::payment_status,
         'partially_paid'::payment_status
       )
       AND created_at < now() - ($1 * interval '1 minute')
     ORDER BY created_at ASC
     LIMIT $2`,
    [olderThan, limit]
  );

  return result.rows.map((row) => {
    const meta = row.metadata || {};
    const amountPaid = getAmountPaid(meta);
    const expectedCharge = getChargeAmountForOrder(row);
    const balanceDue = money(Math.max(0, money(row.total) - amountPaid));
    const externalRef =
      typeof meta.moolre_externalref === 'string' ? meta.moolre_externalref : null;

    let issue: ReconcileIssue = 'stale_unpaid';
    if (row.payment_status === 'partially_paid') {
      issue = 'partial_balance_due';
    } else if (!externalRef) {
      issue = 'missing_external_ref';
    }

    return {
      id: row.id,
      order_number: row.order_number,
      email: row.email,
      total: money(row.total),
      payment_status: row.payment_status,
      status: row.status,
      created_at: row.created_at,
      metadata: row.metadata,
      age_minutes: Math.round(Number(row.age_minutes)),
      amount_paid: amountPaid,
      expected_charge: expectedCharge,
      balance_due: balanceDue,
      external_ref: externalRef,
      issue,
      issue_label: issueLabel(issue),
    };
  });
}

export async function checkOrderAgainstGateway(orderNumber: string): Promise<ReconcileCheckResult | null> {
  const row = await queryOne<OrderRow>(
    `SELECT id, order_number, email, total,
            payment_status::text AS payment_status,
            status::text AS status,
            created_at::text AS created_at,
            metadata,
            EXTRACT(EPOCH FROM (now() - created_at)) / 60 AS age_minutes
     FROM orders WHERE order_number = $1::text LIMIT 1`,
    [orderNumber]
  );
  if (!row) return null;

  const meta = row.metadata || {};
  const amountPaid = getAmountPaid(meta);
  const expectedCharge = getChargeAmountForOrder(row);
  const balanceDue = money(Math.max(0, money(row.total) - amountPaid));
  const externalRef = await resolveMoolreExternalRefForOrder(orderNumber);
  const hasStoredRef = typeof meta.moolre_externalref === 'string' && !!meta.moolre_externalref;

  let issue: ReconcileIssue = 'unknown';
  let proposed_action: ReconcileCheckResult['proposed_action'] = 'none';
  let proposed_label = 'No action needed';
  let safe_to_apply = false;

  if (row.payment_status === 'paid') {
    issue = 'synced';
    proposed_label = 'Already fully paid locally';
  } else if (!hasStoredRef && row.payment_status !== 'partially_paid') {
    issue = 'missing_external_ref';
    proposed_action = 'manual_review';
    proposed_label = 'Create a new payment link from the order / pay page';
  } else {
    const gateway = await fetchMoolrePaymentStatus(externalRef);

    if (!gateway.verified) {
      issue = row.payment_status === 'partially_paid' ? 'partial_balance_due' : 'gateway_unpaid';
      proposed_action = 'manual_review';
      proposed_label =
        row.payment_status === 'partially_paid'
          ? 'Deposit on file; balance still unpaid at gateway — send balance link'
          : 'Gateway does not show a successful payment for the latest reference';
      return {
        id: row.id,
        order_number: row.order_number,
        email: row.email,
        total: money(row.total),
        payment_status: row.payment_status,
        status: row.status,
        created_at: row.created_at,
        metadata: row.metadata,
        age_minutes: Math.round(Number(row.age_minutes)),
        amount_paid: amountPaid,
        expected_charge: expectedCharge,
        balance_due: balanceDue,
        external_ref: hasStoredRef ? externalRef : null,
        issue,
        issue_label: issueLabel(issue),
        gateway: {
          verified: false,
          amount: gateway.amount,
          status: gateway.status,
        },
        proposed_action,
        proposed_label,
        safe_to_apply,
      };
    }

    const gatewayAmount = gateway.amount != null ? money(gateway.amount) : undefined;
    const matchesExpected =
      gatewayAmount != null && expectedCharge > 0 && Math.abs(gatewayAmount - expectedCharge) <= 0.01;
    const matchesFullTotal =
      gatewayAmount != null && Math.abs(gatewayAmount - money(row.total)) <= 0.01;

    if (matchesExpected || matchesFullTotal) {
      issue = 'gateway_paid_local_unpaid';
      proposed_action = 'apply_payment';
      proposed_label = matchesFullTotal
        ? `Apply verified full payment of GH₵ ${gatewayAmount?.toFixed(2)}`
        : `Apply verified charge of GH₵ ${gatewayAmount?.toFixed(2)} (expected GH₵ ${expectedCharge.toFixed(2)})`;
      safe_to_apply = true;
    } else if (gatewayAmount != null) {
      issue = 'amount_mismatch';
      proposed_action = 'manual_review';
      proposed_label = `Gateway paid GH₵ ${gatewayAmount.toFixed(2)} but expected GH₵ ${expectedCharge.toFixed(2)} — review manually`;
    } else {
      issue = 'gateway_paid_local_unpaid';
      proposed_action = 'manual_review';
      proposed_label = 'Gateway reports success but amount missing — review manually';
    }

    return {
      id: row.id,
      order_number: row.order_number,
      email: row.email,
      total: money(row.total),
      payment_status: row.payment_status,
      status: row.status,
      created_at: row.created_at,
      metadata: row.metadata,
      age_minutes: Math.round(Number(row.age_minutes)),
      amount_paid: amountPaid,
      expected_charge: expectedCharge,
      balance_due: balanceDue,
      external_ref: externalRef,
      issue,
      issue_label: issueLabel(issue),
      gateway: {
        verified: gateway.verified,
        amount: gatewayAmount,
        status: gateway.status,
      },
      proposed_action,
      proposed_label,
      safe_to_apply,
    };
  }

  return {
    id: row.id,
    order_number: row.order_number,
    email: row.email,
    total: money(row.total),
    payment_status: row.payment_status,
    status: row.status,
    created_at: row.created_at,
    metadata: row.metadata,
    age_minutes: Math.round(Number(row.age_minutes)),
    amount_paid: amountPaid,
    expected_charge: expectedCharge,
    balance_due: balanceDue,
    external_ref: hasStoredRef ? externalRef : null,
    issue,
    issue_label: issueLabel(issue),
    gateway: { verified: false },
    proposed_action,
    proposed_label,
    safe_to_apply,
  };
}

export async function applySafeReconciliation(input: {
  orderNumber: string;
  adminUserId: string;
  adminEmail?: string;
}): Promise<{
  ok: boolean;
  message: string;
  payment_status?: string;
  check?: ReconcileCheckResult;
}> {
  const check = await checkOrderAgainstGateway(input.orderNumber);
  if (!check) {
    return { ok: false, message: 'Order not found' };
  }

  if (!check.safe_to_apply || check.proposed_action !== 'apply_payment') {
    await writeReconcileLog({
      orderNumber: input.orderNumber,
      action: 'check_only',
      adminUserId: input.adminUserId,
      adminEmail: input.adminEmail,
      result: 'skipped',
      details: { reason: check.proposed_label, issue: check.issue, gateway: check.gateway },
    });
    return { ok: false, message: check.proposed_label, check };
  }

  const charge =
    check.gateway.amount != null && Math.abs(check.gateway.amount - check.expected_charge) <= 0.01
      ? check.gateway.amount
      : check.gateway.amount != null && Math.abs(check.gateway.amount - check.total) <= 0.01
        ? check.gateway.amount
        : check.expected_charge;

  const moolreRef = check.external_ref || 'reconcile';
  const paidRow = await queryOne<{ result: Record<string, unknown> }>(
    `SELECT record_order_payment($1, $2, $3) AS result`,
    [input.orderNumber, moolreRef, charge]
  );
  const orderJson = paidRow?.result;
  if (!orderJson?.id) {
    await writeReconcileLog({
      orderNumber: input.orderNumber,
      action: 'apply_payment',
      adminUserId: input.adminUserId,
      adminEmail: input.adminEmail,
      result: 'failed',
      details: { charge, check },
    });
    return { ok: false, message: 'Database update failed', check };
  }

  if (orderJson.payment_status === 'paid' && orderJson.email) {
    try {
      await query(`SELECT update_customer_stats($1, $2)`, [
        String(orderJson.email),
        Number(orderJson.total),
      ]);
    } catch {
      /* non-fatal */
    }
  }

  await writeReconcileLog({
    orderNumber: input.orderNumber,
    action: 'apply_payment',
    adminUserId: input.adminUserId,
    adminEmail: input.adminEmail,
    result: 'applied',
    details: {
      charge,
      previous_status: check.payment_status,
      new_status: orderJson.payment_status,
      gateway: check.gateway,
    },
  });

  return {
    ok: true,
    message:
      orderJson.payment_status === 'partially_paid'
        ? 'Deposit applied from gateway verification'
        : 'Payment applied from gateway verification',
    payment_status: String(orderJson.payment_status),
    check: {
      ...check,
      payment_status: String(orderJson.payment_status),
      issue: 'synced',
      issue_label: issueLabel('synced'),
      proposed_action: 'none',
      proposed_label: 'Applied successfully',
      safe_to_apply: false,
    },
  };
}

export async function writeReconcileLog(input: {
  orderNumber: string;
  action: string;
  adminUserId: string;
  adminEmail?: string;
  result: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO payment_reconciliation_log
         (order_number, action, result, admin_user_id, admin_email, details)
       VALUES ($1, $2, $3, $4::uuid, $5, $6::jsonb)`,
      [
        input.orderNumber,
        input.action,
        input.result,
        input.adminUserId,
        input.adminEmail || null,
        JSON.stringify(input.details || {}),
      ]
    );
  } catch (err) {
    console.error('[Reconcile] log write failed:', err);
  }
}

export async function listReconcileLogs(limit = 30) {
  try {
    const result = await query(
      `SELECT id, order_number, action, result, admin_email, details, created_at
       FROM payment_reconciliation_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    console.error('[Reconcile] list logs failed:', err);
    return [];
  }
}
