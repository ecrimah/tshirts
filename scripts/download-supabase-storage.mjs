/**
 * Download files from Supabase Storage bucket `products` into local UPLOAD_DIR.
 * Run while you still have temporary Supabase credentials.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   UPLOAD_DIR (default: ./uploads)
 */
import fs from 'fs';
import path from 'path';

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
const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const uploadDir = env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

if (!base || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for one-time download');
  process.exit(1);
}

fs.mkdirSync(uploadDir, { recursive: true });

async function listAll(prefix = '') {
  const url = `${base}/storage/v1/object/list/products`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function download(objectPath) {
  const url = `${base}/storage/v1/object/public/products/${objectPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${objectPath}: ${res.status}`);
  const dest = path.join(uploadDir, objectPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function walk(prefix = '') {
  const entries = await listAll(prefix);
  for (const entry of entries) {
    const name = entry.name;
    const full = prefix ? `${prefix}/${name}` : name;
    if (entry.id === null) {
      await walk(full);
    } else {
      process.stdout.write(`downloading ${full}\n`);
      await download(full);
    }
  }
}

await walk('');
console.log('Storage download complete →', uploadDir);
