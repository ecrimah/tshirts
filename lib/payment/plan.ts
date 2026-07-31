export type PaymentOption = 'full' | 'half';

export type PaymentPlan = {
  option: PaymentOption;
  orderTotal: number;
  dueNow: number;
  balanceDue: number;
};

function money(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export function normalizePaymentOption(value: unknown): PaymentOption {
  return value === 'half' ? 'half' : 'full';
}

/** Split order total into amount due now and remaining balance. */
export function computePaymentPlan(total: number, option: PaymentOption): PaymentPlan {
  const orderTotal = money(total);
  if (option === 'half') {
    const dueNow = money(orderTotal / 2);
    return {
      option,
      orderTotal,
      dueNow,
      balanceDue: money(orderTotal - dueNow),
    };
  }
  return {
    option: 'full',
    orderTotal,
    dueNow: orderTotal,
    balanceDue: 0,
  };
}

export function getAmountPaid(metadata: Record<string, unknown> | null | undefined): number {
  const raw = metadata?.amount_paid;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
  return Number.isFinite(n) ? money(n) : 0;
}

/** Amount the next Moolre link should charge (server-trusted). */
export function getChargeAmountForOrder(order: {
  total: number;
  payment_status: string;
  metadata?: Record<string, unknown> | null;
}): number {
  const meta = order.metadata || {};
  const orderTotal = money(order.total);
  const paid = getAmountPaid(meta);

  if (order.payment_status === 'paid' || paid >= orderTotal - 0.001) {
    return 0;
  }

  if (order.payment_status === 'partially_paid' || paid > 0) {
    return money(Math.max(0, orderTotal - paid));
  }

  const option = normalizePaymentOption(meta.payment_option);
  return computePaymentPlan(orderTotal, option).dueNow;
}

export function getBalanceDue(order: {
  total: number;
  payment_status: string;
  metadata?: Record<string, unknown> | null;
}): number {
  if (order.payment_status === 'paid') return 0;
  return money(Math.max(0, money(order.total) - getAmountPaid(order.metadata)));
}
