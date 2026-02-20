#!/usr/bin/env node
/**
 * Quick check: Supabase env vars and API connectivity (app client, not MCP).
 * Run: node scripts/check-supabase-connection.mjs
 * Loads .env.local from project root if present.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = existsSync(resolve(root, '.env.local')) ? resolve(root, '.env.local') : resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase connection check\n');

if (!url) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}
if (!anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('URL:', url);
console.log('Anon key: present (hidden)\n');

const supabase = createClient(url, anonKey);

try {
  const { data, error } = await supabase.from('categories').select('id, name').limit(3);
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  console.log('OK – Supabase API reachable. Sample categories:', data?.length ?? 0);
  if (data?.length) console.log(data);
} catch (e) {
  console.error('Request failed:', e.message);
  process.exit(1);
}
