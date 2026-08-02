-- Financial / catalog integrity + query indexes (safe additive).

-- Prefer GHS for this store (existing USD rows left unchanged).
ALTER TABLE public.orders ALTER COLUMN currency SET DEFAULT 'GHS';

-- Non-negative money / quantity guards (validate existing data first in apply script if needed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_nonneg'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_nonneg CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_subtotal_nonneg'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_positive'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_unit_price_nonneg'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_unit_price_nonneg CHECK (unit_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_quantity_nonneg'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_quantity_nonneg CHECK (quantity >= 0);
  END IF;
END $$;

-- Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created
  ON public.orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_email_lower
  ON public.orders (lower(email));

CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_pos
  ON public.product_images (product_id, position);

CREATE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (lower(email));
