/**
 * One-time dump helpers for migrating off Supabase.
 * Requires env (when you provide it):
 *   SUPABASE_DB_PASSWORD or SOURCE_DATABASE_URL
 *   NEXT_PUBLIC_SUPABASE_URL (to derive project ref) OR SOURCE_DATABASE_URL
 *
 * Usage:
 *   node scripts/dump-from-supabase.mjs
 *
 * Outputs into ./migration-data/
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

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
const outDir = path.join(process.cwd(), 'migration-data');
fs.mkdirSync(outDir, { recursive: true });

let sourceUrl = env.SOURCE_DATABASE_URL || env.DATABASE_URL_SOURCE;
if (!sourceUrl) {
  const projectRef = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const pw = env.SUPABASE_DB_PASSWORD;
  if (!projectRef || !pw) {
    console.error('Set SOURCE_DATABASE_URL, or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD');
    process.exit(1);
  }
  sourceUrl = `postgresql://postgres:${encodeURIComponent(pw)}@db.${projectRef}.supabase.co:5432/postgres`;
}

const publicDump = path.join(outDir, 'public.dump');
const authCsv = path.join(outDir, 'auth_users.csv');

console.log('Dumping public schema to', publicDump);
let r = spawnSync(
  'pg_dump',
  [sourceUrl, '--format=custom', '--schema=public', '--no-owner', '--no-acl', `-f${publicDump}`],
  { stdio: 'inherit', shell: true }
);
if (r.status !== 0) process.exit(r.status ?? 1);

console.log('Exporting auth.users to', authCsv);
r = spawnSync(
  'psql',
  [
    sourceUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `\\copy (SELECT id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, last_sign_in_at FROM auth.users) TO '${authCsv.replace(/\\/g, '/')}' WITH CSV HEADER`,
  ],
  { stdio: 'inherit', shell: true }
);
if (r.status !== 0) {
  console.warn('auth.users export failed — you can export manually from Supabase SQL editor.');
}

console.log('Done. Next:');
console.log('  1. Restore dump into VPS Postgres');
console.log('  2. psql $DATABASE_URL -f db/migrations/002_post_supabase_import.sql');
console.log('  3. Import auth_users.csv into public.users (002 may already copy if auth schema restored)');
console.log('  4. node scripts/migrate-storage-urls.mjs');
