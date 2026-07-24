/**
 * Rewrite Supabase Storage public URLs to local /uploads paths in Postgres.
 *
 * Env:
 *   DATABASE_URL (required)
 *   OLD_STORAGE_HOST (optional, default *.supabase.co/storage/v1/object/public/products)
 *
 * Usage:
 *   node scripts/migrate-storage-urls.mjs
 */
import fs from 'fs';
import pg from 'pg';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = { ...loadEnvFile('.env.local'), ...process.env };
if (!env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const rewriteSql = `
UPDATE product_images
SET url = regexp_replace(
  url,
  '^https?://[^/]+/storage/v1/object/public/products/',
  '/uploads/'
)
WHERE url ~ 'supabase\\.co/storage/v1/object/public/products/';

UPDATE categories
SET image_url = regexp_replace(
  image_url,
  '^https?://[^/]+/storage/v1/object/public/products/',
  '/uploads/'
)
WHERE image_url ~ 'supabase\\.co/storage/v1/object/public/products/';

UPDATE products
SET metadata = regexp_replace(metadata::text, 'https?://[^"]+/storage/v1/object/public/products/', '/uploads/', 'g')::jsonb
WHERE metadata::text LIKE '%supabase.co/storage%';
`;

try {
  await client.query('BEGIN');
  const images = await client.query(
    `UPDATE product_images
     SET url = regexp_replace(url, '^https?://[^/]+/storage/v1/object/public/products/', '/uploads/')
     WHERE url ~ 'supabase\\.co/storage/v1/object/public/products/'`
  );
  const cats = await client.query(
    `UPDATE categories
     SET image_url = regexp_replace(image_url, '^https?://[^/]+/storage/v1/object/public/products/', '/uploads/')
     WHERE image_url IS NOT NULL AND image_url ~ 'supabase\\.co/storage/v1/object/public/products/'`
  );
  await client.query('COMMIT');
  console.log(`Updated product_images: ${images.rowCount}, categories: ${cats.rowCount}`);
  console.log('Remember to download Storage objects into UPLOAD_DIR so /uploads/* resolves.');
} catch (err) {
  await client.query('ROLLBACK');
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
