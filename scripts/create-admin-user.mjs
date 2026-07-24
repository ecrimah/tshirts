/**
 * Create an admin user in public.users + profiles (role admin).
 * Reads DATABASE_URL from .env.local.
 *
 * Usage: node scripts/create-admin-user.mjs <email> <password>
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const altPath = path.join(__dirname, '..', '.env');
  const p = fs.existsSync(envPath) ? envPath : fs.existsSync(altPath) ? altPath : null;
  if (!p) return {};
  return Object.fromEntries(
    fs
      .readFileSync(p, 'utf-8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l.trim()))
      .map((l) => {
        const eq = l.indexOf('=');
        const key = l.slice(0, eq).trim();
        let val = l.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return [key, val];
      })
  );
}

const env = { ...process.env, ...loadEnv() };
const databaseUrl = env.DATABASE_URL;
const email = process.argv[2] || env.CREATE_ADMIN_EMAIL;
const password = process.argv[3] || env.CREATE_ADMIN_PASSWORD;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

if (!email || !password) {
  console.error('Usage: node scripts/create-admin-user.mjs <email> <password>');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });

async function main() {
  const client = await pool.connect();
  try {
    const normalized = email.toLowerCase();
    const existing = await client.query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [normalized]);

    const hash = await bcrypt.hash(password, 12);

    if (existing.rows.length) {
      const userId = existing.rows[0].id;
      await client.query(`UPDATE users SET encrypted_password = $2, updated_at = now() WHERE id = $1`, [
        userId,
        hash,
      ]);
      await client.query(
        `UPDATE profiles SET role = 'admin'::user_role, email = $2, updated_at = now() WHERE id = $1`,
        [userId, normalized]
      );
      console.log('Existing user updated to admin:', normalized);
      return;
    }

    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
       VALUES ($1, $2, now(), '{}'::jsonb)
       RETURNING id`,
      [normalized, hash]
    );
    const userId = inserted.rows[0].id;
    await client.query(
      `INSERT INTO profiles (id, email, role, full_name)
       VALUES ($1, $2, 'admin'::user_role, $3)
       ON CONFLICT (id) DO UPDATE SET role = 'admin'::user_role, email = EXCLUDED.email, updated_at = now()`,
      [userId, normalized, 'Admin']
    );
    await client.query('COMMIT');
    console.log('Admin user created:', normalized);
    console.log('Login at: /admin/login');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
