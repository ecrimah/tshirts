-- Atomic payment recording for full + half (deposit) payments.
CREATE OR REPLACE FUNCTION public.record_order_payment(
  order_ref text,
  moolre_ref text DEFAULT NULL,
  charged_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing orders;
  updated_order orders;
  paid_so_far numeric;
  charge numeric;
  new_paid numeric;
  order_total numeric;
  bal numeric;
BEGIN
  SELECT * INTO existing FROM orders WHERE order_number = order_ref;

  IF existing.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF existing.payment_status = 'paid' THEN
    RETURN to_jsonb(existing);
  END IF;

  order_total := COALESCE(existing.total, 0);
  paid_so_far := COALESCE((existing.metadata->>'amount_paid')::numeric, 0);

  charge := COALESCE(
    charged_amount,
    NULLIF((existing.metadata->>'pending_charge_amount')::numeric, 0),
    order_total - paid_so_far
  );

  IF charge IS NULL OR charge <= 0 THEN
    RETURN to_jsonb(existing);
  END IF;

  new_paid := ROUND((paid_so_far + charge)::numeric, 2);
  bal := ROUND(GREATEST(0, order_total - new_paid)::numeric, 2);

  IF new_paid + 0.009 >= order_total THEN
    UPDATE orders
    SET
      payment_status = 'paid',
      status = CASE
          WHEN status IN ('pending', 'awaiting_payment') THEN 'processing'::order_status
          ELSE status
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) ||
                 jsonb_build_object(
                     'moolre_reference', moolre_ref,
                     'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                     'amount_paid', order_total,
                     'balance_due', 0,
                     'last_charge_amount', charge
                 ) - 'pending_charge_amount'
    WHERE order_number = order_ref
      AND payment_status <> 'paid'::payment_status
    RETURNING * INTO updated_order;

    IF updated_order.id IS NOT NULL AND (updated_order.metadata->>'stock_reduced') IS NULL THEN
      UPDATE products p
      SET quantity = GREATEST(0, p.quantity - oi.quantity)
      FROM order_items oi
      WHERE oi.order_id = updated_order.id AND oi.product_id = p.id;

      UPDATE product_variants pv
      SET quantity = GREATEST(0, pv.quantity - oi.quantity)
      FROM order_items oi
      WHERE oi.order_id = updated_order.id
        AND oi.product_id = pv.product_id
        AND oi.variant_name IS NOT NULL
        AND oi.variant_name = pv.name;

      UPDATE orders
      SET metadata = metadata || '{"stock_reduced": true}'::jsonb
      WHERE id = updated_order.id;

      SELECT * INTO updated_order FROM orders WHERE id = updated_order.id;
    END IF;

    RETURN to_jsonb(COALESCE(updated_order, existing));
  END IF;

  UPDATE orders
  SET
    payment_status = 'partially_paid',
    status = CASE
        WHEN status IN ('pending', 'awaiting_payment') THEN 'processing'::order_status
        ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'deposit_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                   'amount_paid', new_paid,
                   'balance_due', bal,
                   'last_charge_amount', charge,
                   'balance_due_before', 'pickup_or_delivery'
               ) - 'pending_charge_amount'
  WHERE order_number = order_ref
    AND payment_status <> 'paid'::payment_status
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL AND (updated_order.metadata->>'stock_reduced') IS NULL THEN
    UPDATE products p
    SET quantity = GREATEST(0, p.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = updated_order.id AND oi.product_id = p.id;

    UPDATE product_variants pv
    SET quantity = GREATEST(0, pv.quantity - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = updated_order.id
      AND oi.product_id = pv.product_id
      AND oi.variant_name IS NOT NULL
      AND oi.variant_name = pv.name;

    UPDATE orders
    SET metadata = metadata || '{"stock_reduced": true}'::jsonb
    WHERE id = updated_order.id;

    SELECT * INTO updated_order FROM orders WHERE id = updated_order.id;
  END IF;

  RETURN to_jsonb(COALESCE(updated_order, existing));
END;
$$;
