-- Audit trail for admin payment reconciliation actions.
CREATE TABLE IF NOT EXISTS public.payment_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  admin_user_id uuid,
  admin_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_log_created
  ON public.payment_reconciliation_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_log_order
  ON public.payment_reconciliation_log (order_number);
