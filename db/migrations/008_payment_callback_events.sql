-- Idempotent Moolre callback / verification event log.
CREATE TABLE IF NOT EXISTS public.payment_callback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'moolre',
  order_number text NOT NULL,
  external_ref text,
  gateway_reference text,
  event_type text NOT NULL DEFAULT 'callback',
  payload_hash text,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  amount numeric,
  currency text DEFAULT 'GHS',
  failure_reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callback_events_gateway_ref
  ON public.payment_callback_events (gateway, gateway_reference)
  WHERE gateway_reference IS NOT NULL AND processing_status = 'processed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_callback_events_external_ref
  ON public.payment_callback_events (gateway, external_ref, event_type)
  WHERE external_ref IS NOT NULL AND processing_status = 'processed';

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_order
  ON public.payment_callback_events (order_number, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_callback_events_status
  ON public.payment_callback_events (processing_status, received_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.payment_callback_events TO store_mamator;
