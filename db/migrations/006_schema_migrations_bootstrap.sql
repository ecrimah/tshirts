-- Ensure migration tracking exists (was missing on store_mamator after manual cutover).
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.schema_migrations TO store_mamator;

-- Record historically applied migrations so migrate-db.mjs does not re-run them.
INSERT INTO public.schema_migrations (id) VALUES
  ('001_plain_postgres.sql'),
  ('002_mark_order_paid_idempotent.sql'),
  ('002_post_supabase_import.sql'),
  ('003_add_partially_paid_enum.sql'),
  ('004_record_order_payment.sql'),
  ('005_payment_reconciliation_log.sql')
ON CONFLICT (id) DO NOTHING;
