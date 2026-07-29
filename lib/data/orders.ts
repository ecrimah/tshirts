import { query, queryOne, withTransaction } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth/session';
import { parseStorePricingValue, resolveCartLineUnitPrice } from '@/lib/pricing';

export type CartLineInput = {
  id: string;
  name: string;
  slug?: string;
  variant?: string | null;
  quantity: number;
  image?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProductId(idOrSlug: string): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) {
    // Cast both sides: a bare $1 after $1::uuid is typed as uuid, so slug = $1 becomes text = uuid.
    const row = await queryOne<{ id: string }>(
      `SELECT id FROM products WHERE id = $1::uuid OR slug = $1::text`,
      [idOrSlug]
    );
    return row?.id ? String(row.id) : null;
  }
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM products WHERE slug = $1::text OR id::text = $1::text`,
    [idOrSlug]
  );
  return row?.id ? String(row.id) : null;
}

export async function createOrderFromCheckout(input: {
  userId?: string | null;
  orderNumber: string;
  trackingNumber: string;
  shippingData: Record<string, string>;
  deliveryMethod: string;
  paymentMethod: string;
  cart: CartLineInput[];
  shippingCost?: number;
  tax?: number;
}) {
  const shippingCost = Math.max(0, Number(input.shippingCost) || 0);
  const tax = Math.max(0, Number(input.tax) || 0);

  const pricingRow = await queryOne<{ value: unknown }>(
    `SELECT value FROM site_settings WHERE key = 'store_pricing' LIMIT 1`
  );
  const salesActive = parseStorePricingValue(pricingRow?.value).sales_active;

  const resolvedLines: { item: CartLineInput; productId: string }[] = [];
  for (const item of input.cart) {
    const productId = await resolveProductId(item.id);
    if (!productId) {
      throw new Error(`Product not found: ${item.name}. Please remove it from your cart and try again.`);
    }
    resolvedLines.push({ item, productId });
  }

  const uniqueIds = [...new Set(resolvedLines.map((l) => l.productId))];
  const productsResult = await query(
    `SELECT id, price, sale_price, compare_at_price, metadata,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'name', pv.name, 'option1', pv.option1, 'option2', pv.option2, 'price', pv.price, 'sale_price', pv.sale_price))
         FROM product_variants pv WHERE pv.product_id = p.id),
        '[]'::jsonb
      ) AS product_variants
     FROM products p WHERE p.id = ANY($1::uuid[])`,
    [uniqueIds]
  );

  const productMap = new Map(productsResult.rows.map((p) => [String(p.id), p]));

  let computedSubtotal = 0;
  const orderItemsPayload: Record<string, unknown>[] = [];

  for (const { item, productId } of resolvedLines) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 0));
    const p = productMap.get(productId) as Record<string, unknown> | undefined;
    if (!p) {
      throw new Error(`Product not found: ${item.name}. Please remove it from your cart and try again.`);
    }
    const unit = resolveCartLineUnitPrice(
      p as Parameters<typeof resolveCartLineUnitPrice>[0],
      item.variant,
      salesActive
    );
    computedSubtotal += unit * qty;
    const prodMeta = (p.metadata || {}) as Record<string, unknown>;
    orderItemsPayload.push({
      product_id: productId,
      product_name: item.name,
      variant_name: item.variant || null,
      quantity: qty,
      unit_price: unit,
      total_price: unit * qty,
      metadata: {
        image: item.image,
        slug: item.slug,
        preorder_shipping: prodMeta.preorder_shipping || null,
      },
    });
  }

  const checkoutTotal = computedSubtotal + shippingCost + tax;
  const shipping = input.shippingData;

  return withTransaction(async (client) => {
    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, email, phone, status, payment_status, currency,
        subtotal, tax_total, shipping_total, discount_total, total,
        shipping_method, payment_method, shipping_address, billing_address, metadata
      ) VALUES (
        $1, $2::uuid, $3, $4, 'pending'::order_status, 'pending'::payment_status, 'GHS',
        $5, $6, $7, 0, $8,
        $9, $10, $11::jsonb, $12::jsonb, $13::jsonb
      ) RETURNING *`,
      [
        input.orderNumber,
        input.userId || null,
        shipping.email,
        shipping.phone,
        computedSubtotal,
        tax,
        shippingCost,
        checkoutTotal,
        input.deliveryMethod,
        input.paymentMethod,
        JSON.stringify(shipping),
        JSON.stringify(shipping),
        JSON.stringify({
          guest_checkout: !input.userId,
          first_name: shipping.firstName,
          last_name: shipping.lastName,
          tracking_number: input.trackingNumber,
          payment_method: input.paymentMethod,
        }),
      ]
    );

    const order = orderResult.rows[0];

    for (const row of orderItemsPayload) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, variant_name, quantity, unit_price, total_price, metadata)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          order.id,
          row.product_id,
          row.product_name,
          row.variant_name,
          row.quantity,
          row.unit_price,
          row.total_price,
          JSON.stringify(row.metadata),
        ]
      );
    }

    await client.query(`SELECT upsert_customer_from_order($1, $2, $3, $4, $5, $6::uuid, $7::jsonb)`, [
      shipping.email,
      shipping.phone,
      `${shipping.firstName} ${shipping.lastName}`.trim(),
      shipping.firstName,
      shipping.lastName,
      input.userId || null,
      JSON.stringify(shipping),
    ]);

    return order;
  });
}

export async function listOrdersForUser(userId: string) {
  const result = await query(
    `SELECT o.*,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at)
         FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o
     WHERE o.user_id = $1::uuid
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function listOrdersAdmin() {
  const result = await query(
    `SELECT o.*,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'product_name', oi.product_name,
          'variant_name', oi.variant_name,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price,
          'metadata', oi.metadata
        ) ORDER BY oi.created_at)
         FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o
     ORDER BY o.created_at DESC`
  );
  return result.rows;
}

export async function getOrderById(id: string, userId?: string | null, isStaff?: boolean) {
  const row = await queryOne(
    `SELECT o.*,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at)
         FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o WHERE o.id = $1::uuid OR o.order_number = $1::text`,
    [id]
  );
  if (!row) return null;
  // Customers may only read their own orders; staff may read any
  if (!isStaff) {
    if (!userId || row.user_id !== userId) return null;
  }
  return row;
}

export async function trackOrder(email: string, orderNumber: string) {
  const row = await queryOne(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.total, o.email, o.created_at,
            o.shipping_address, o.metadata,
      COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_name', oi.product_name,
            'variant_name', oi.variant_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'metadata', oi.metadata,
            'product_images', COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('url', pi.url) ORDER BY pi.position)
               FROM product_images pi WHERE pi.product_id = oi.product_id),
              '[]'::jsonb
            )
          )
        ) FROM order_items oi WHERE oi.order_id = o.id),
        '[]'::jsonb
      ) AS order_items
     FROM orders o
     WHERE o.order_number = $1 AND lower(o.email) = lower($2)`,
    [orderNumber, email]
  );
  return row;
}

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request);
  return session?.sub ?? null;
}
