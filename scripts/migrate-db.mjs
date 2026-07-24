/**
 * Apply db/migrations/*.sql in sorted order with schema_migrations tracking.
 *
 * Usage: node scripts/migrate-db.mjs
 * Env: DATABASE_URL in .env.local or process.env
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
  console.error('ERROR: DATABASE_URL is not set (.env.local or environment).');
  process.exit(1);
}

const migrationsDir = path.join(root, 'db', 'migrations');

function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    console.error('ERROR: migrations directory not found:', migrationsDir);
    process.exit(1);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedIds(client) {
  const { rows } = await client.query('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

async function main() {
  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('Connected to database.');

  try {
    await ensureMigrationsTable(client);
    const done = await appliedIds(client);

    for (const file of files) {
      const id = file;
      if (done.has(id)) {
        console.log('Skip (already applied):', id);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log('Applying:', id);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (id) VALUES ($1)',
          [id]
        );
        await client.query('COMMIT');
        console.log('Applied:', id);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Failed:', id);
        throw err;
      }
    }

    console.log('Migrations complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
