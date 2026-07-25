import { query } from '@/lib/db';

export type ProductListOptions = {
  featured?: boolean;
  limit?: number;
  categorySlug?: string | null;
  status?: string;
  includeArchived?: boolean;
};

export async function listProducts(options: ProductListOptions = {}) {
  const limit = options.limit ?? 50;
  const status = options.status ?? 'active';
  const params: unknown[] = [];
  const where: string[] = [];

  if (!options.includeArchived) {
    params.push(status);
    where.push(`p.status = $${params.length}::product_status`);
  }

  if (options.featured) {
    where.push(`p.featured = true`);
  }

  if (options.categorySlug) {
    params.push(options.categorySlug);
    where.push(`c.slug = $${params.length}`);
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(
    `
    SELECT
      p.id, p.name, p.slug, p.price, p.sale_price, p.compare_at_price, p.quantity,
      p.description, p.short_description, p.metadata, p.featured, p.status,
      p.category_id, p.created_at, p.rating_avg, p.review_count,
      CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END AS categories,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'position', pi.position, 'alt_text', pi.alt_text) ORDER BY pi.position)
         FROM product_images pi WHERE pi.product_id = p.id),
        '[]'::jsonb
      ) AS product_images,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'name', pv.name, 'price', pv.price, 'sale_price', pv.sale_price, 'quantity', pv.quantity))
         FROM product_variants pv WHERE pv.product_id = p.id),
        '[]'::jsonb
      ) AS product_variants
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows;
}

export async function getProductBySlug(slug: string) {
  const rows = await query(
    `
    SELECT
      p.*,
      CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END AS categories,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'alt_text', pi.alt_text) ORDER BY pi.position)
         FROM product_images pi WHERE pi.product_id = p.id),
        '[]'::jsonb
      ) AS product_images,
      COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('id', pv.id, 'name', pv.name, 'price', pv.price, 'sale_price', pv.sale_price, 'quantity', pv.quantity, 'sku', pv.sku))
         FROM product_variants pv WHERE pv.product_id = p.id),
        '[]'::jsonb
      ) AS product_variants
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.slug = $1
    LIMIT 1
    `,
    [slug]
  );
  return rows.rows[0] ?? null;
}

export async function listCategories(activeOnly = true) {
  const result = await query(
    activeOnly
      ? `SELECT * FROM categories WHERE status = 'active' ORDER BY position ASC, name ASC`
      : `SELECT * FROM categories ORDER BY position ASC, name ASC`
  );
  return result.rows;
}
