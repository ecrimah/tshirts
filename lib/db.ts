import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __mamatorPgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL — set it in .env.local (see .env.example)');
  }

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!global.__mamatorPgPool) {
    global.__mamatorPgPool = createPool();
  }
  return global.__mamatorPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rpc<T = unknown>(fnName: string, args: unknown[] = []): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(`SELECT * FROM ${fnName}(${placeholders}) AS result`, args);
  const row = result.rows[0] as { result?: T } | undefined;
  return (row?.result ?? row) as T;
}
