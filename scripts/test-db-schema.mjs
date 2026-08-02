/**
 * Schema smoke test — verifies critical tables and payment RPCs exist.
 *
 * Usage: node scripts/test-db-schema.mjs
 * Env: DATABASE_URL in .env.local or process.env
 *
 * Exit 0 when all checks pass; exit 1 on any failure.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const envLocal = loadEnvFile(path.join(root, '.env.local'));
const databaseUrl = process.env.DATABASE_URL || envLocal.DATABASE_URL;

if (!databaseUrl) {
  console.error('FAIL: DATABASE_URL is not set (.env.local or environment).');
  process.exit(1);
}

const CRITICAL_TABLES = [
  'users',
  'profiles',
  'products',
  'product_images',
  'product_variants',
  'categories',
  'orders',
  'order_items',
  'order_status_history',
  'customers',
  'addresses',
  'coupons',
  'blog_posts',
  'reviews',
  'payment_reconciliation_log',
  'payment_callback_events',
  'schema_migrations',
  'cart_items',
  'wishlist_items',
  'cms_content',
  'banners',
  'store_settings',
  'support_tickets',
  'support_messages',
];

const CRITICAL_FUNCTIONS = ['record_order_payment', 'mark_order_paid'];

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl });
  const failures = [];

  try {
    await client.connect();
    console.log('Connected.');

    const ping = await client.query('SELECT 1 AS ok');
    if (ping.rows[0]?.ok !== 1) {
      failures.push('connection ping');
    } else {
      console.log('OK  connection');
    }

    for (const table of CRITICAL_TABLES) {
      const { rows } = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table]
      );
      if (rows[0]?.exists) {
        console.log(`OK  table ${table}`);
      } else {
        console.error(`FAIL table ${table}`);
        failures.push(`table:${table}`);
      }
    }

    for (const fn of CRITICAL_FUNCTIONS) {
      const { rows } = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = $1
         ) AS exists`,
        [fn]
      );
      if (rows[0]?.exists) {
        console.log(`OK  function ${fn}`);
      } else {
        console.error(`FAIL function ${fn}`);
        failures.push(`function:${fn}`);
      }
    }

    const { rows: migRows } = await client.query(
      'SELECT COUNT(*)::int AS n FROM schema_migrations'
    );
    const migCount = migRows[0]?.n ?? 0;
    if (migCount > 0) {
      console.log(`OK  schema_migrations rows (${migCount})`);
    } else {
      console.error('FAIL schema_migrations is empty (run node scripts/migrate-db.mjs)');
      failures.push('schema_migrations:empty');
    }
  } catch (err) {
    console.error('FAIL:', err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  console.log('\nAll schema smoke checks passed.');
}

main();
