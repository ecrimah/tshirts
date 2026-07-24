/**
 * Export mamator Supabase data via PostgREST (service role) + optional auth users JSON.
 * Does not need direct Postgres/IPv6.
 */
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const env = loadEnv();
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'migration-data');
fs.mkdirSync(outDir, { recursive: true });

async function fetchAll(table) {
  const url = `${base}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) {
    // text[] / generic arrays — emit PG array literal for text
    if (v.length === 0) return `'{}'`;
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) {
      const inner = v
        .map((x) => `"${String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
        .join(',');
      return `'${inner.replace(/'/g, "''")}'`;
    }
    return sqlLiteral(JSON.stringify(v));
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rowsToInsert(table, rows) {
  if (!rows.length) return `-- ${table}: 0 rows\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map((row) => `  (${cols.map((c) => sqlLiteral(row[c])).join(', ')})`);
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${lines.join(',\n')}\nON CONFLICT DO NOTHING;\n`;
}

const tables = [
  'categories',
  'products',
  'product_images',
  'product_variants',
  'profiles',
  'site_settings',
  'store_modules',
  'store_settings',
  'customers',
  'coupons',
  'orders',
  'order_items',
  'reviews',
];

const dump = [];
dump.push('-- Mamator export from Supabase via PostgREST');
dump.push('BEGIN;');

const authUsersPath = path.join(outDir, 'auth_users.json');
if (fs.existsSync(authUsersPath)) {
  const users = JSON.parse(fs.readFileSync(authUsersPath, 'utf8'));
  dump.push('-- public.users from auth.users');
  for (const u of users) {
    dump.push(
      `INSERT INTO users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
VALUES (${sqlLiteral(u.id)}, ${sqlLiteral(u.email)}, ${sqlLiteral(u.encrypted_password)}, ${sqlLiteral(u.email_confirmed_at)}, ${sqlLiteral(u.raw_user_meta_data || {})}, ${sqlLiteral(u.created_at)}, ${sqlLiteral(u.updated_at)}, ${sqlLiteral(u.last_sign_in_at)})
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = EXCLUDED.updated_at,
  last_sign_in_at = EXCLUDED.last_sign_in_at;`
    );
  }
}

for (const table of tables) {
  process.stdout.write(`fetch ${table}...\n`);
  try {
    const rows = await fetchAll(table);
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    dump.push(`-- ${table}: ${rows.length} rows`);
    dump.push(rowsToInsert(table, rows));
  } catch (e) {
    dump.push(`-- SKIP ${table}: ${e.message}`);
    console.warn('skip', table, e.message);
  }
}

dump.push('COMMIT;');
const sqlPath = path.join(outDir, 'data.sql');
fs.writeFileSync(sqlPath, dump.join('\n'));
console.log('Wrote', sqlPath);
