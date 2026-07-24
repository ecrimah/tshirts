import { query } from '@/lib/db';

export async function syncProductMedia(
  productId: string,
  images?: { url: string; position?: number; alt_text?: string }[],
  variants?: {
    name: string;
    sku?: string | null;
    price: number;
    sale_price?: number | null;
    quantity?: number;
    option1?: string | null;
    option2?: string | null;
    metadata?: Record<string, unknown>;
  }[]
) {
  if (images) {
    await query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [productId]);
    for (const [idx, img] of images.entries()) {
      await query(
        `INSERT INTO product_images (product_id, url, position, alt_text) VALUES ($1::uuid, $2, $3, $4)`,
        [productId, img.url, img.position ?? idx, img.alt_text || null]
      );
    }
  }

  if (variants) {
    await query(`DELETE FROM product_variants WHERE product_id = $1::uuid`, [productId]);
    for (const v of variants) {
      await query(
        `INSERT INTO product_variants (product_id, name, sku, price, sale_price, quantity, option1, option2, metadata)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          productId,
          v.name,
          v.sku || null,
          v.price,
          v.sale_price ?? null,
          v.quantity ?? 0,
          v.option1 || null,
          v.option2 || null,
          JSON.stringify(v.metadata || {}),
        ]
      );
    }
  }
}
