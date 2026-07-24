import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);
  const search = searchParams.get('q')?.trim();

  try {
    const params: unknown[] = [limit];
    let where = '';
    if (search) {
      params.unshift(`%${search}%`);
      where = `WHERE c.email ILIKE $1 OR c.full_name ILIKE $1 OR c.phone ILIKE $1`;
      params[1] = limit;
    }

    const result = await query(
      `SELECT c.*,
        p.full_name AS profile_name,
        p.email AS profile_email
       FROM customers c
       LEFT JOIN profiles p ON p.id = c.user_id
       ${where}
       ORDER BY c.last_order_at DESC NULLS LAST, c.created_at DESC
       LIMIT $${params.length}`,
      search ? [`%${search}%`, limit] : [limit]
    );

    return NextResponse.json(result.rows);
  } catch (err: unknown) {
    console.error('[admin/customers]', err);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}
