import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

const CRITICAL_TABLES = [
  'users',
  'profiles',
  'orders',
  'order_items',
  'products',
  'payment_reconciliation_log',
  'payment_callback_events',
  'schema_migrations',
] as const;

export async function GET() {
  const checks: Record<string, boolean> = {};

  try {
    const ping = await queryOne<{ ok: number }>('SELECT 1 AS ok');
    checks.connection = ping?.ok === 1;
  } catch {
    checks.connection = false;
  }

  for (const table of CRITICAL_TABLES) {
    try {
      const row = await queryOne<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table]
      );
      checks[`table_${table}`] = row?.exists === true;
    } catch {
      checks[`table_${table}`] = false;
    }
  }

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      ...(healthy ? {} : { message: 'One or more database checks failed' }),
    },
    { status: healthy ? 200 : 503 }
  );
}
