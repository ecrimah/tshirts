-- Add partially_paid to payment_status (must commit before functions use it).
DO $$
BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_paid';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
