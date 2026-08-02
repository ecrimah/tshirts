import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth, isStaffRole } from '@/lib/auth';
import { getOrderById, getUserIdFromRequest } from '@/lib/data/orders';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const auth = await verifyAuth(request);
  const userId = await getUserIdFromRequest(request);
  const isStaff = auth.authenticated && isStaffRole(auth.role || '');

  const order = await getOrderById(id, userId, isStaff);
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  if ('payment_status' in body) {
    return NextResponse.json(
      { error: 'payment_status cannot be changed via order PATCH; use Payment Reconcile instead' },
      { status: 400 }
    );
  }

  const allowed = ['status', 'notes', 'metadata', 'shipping_address'] as const;
  const sets: string[] = [];
  const params: unknown[] = [id];
  let i = 2;

  for (const key of allowed) {
    if (key in body) {
      if (key === 'status') {
        sets.push(`${key} = $${i}::order_status`);
        params.push(body[key]);
      } else if (key === 'metadata' || key === 'shipping_address') {
        sets.push(`${key} = $${i}::jsonb`);
        params.push(JSON.stringify(body[key]));
      } else {
        sets.push(`${key} = $${i}`);
        params.push(body[key]);
      }
      i++;
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (body.status === 'shipped' || body.status === 'delivered') {
    const current = await queryOne<{ payment_status: string }>(
      `SELECT payment_status::text AS payment_status FROM orders WHERE id = $1::uuid OR order_number = $1::text`,
      [id]
    );
    if (current && current.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Order must be fully paid before packaged/delivered status' },
        { status: 400 }
      );
    }
  }

  sets.push('updated_at = now()');

  try {
    const updated = await queryOne(
      `UPDATE orders SET ${sets.join(', ')} WHERE id = $1::uuid OR order_number = $1::text RETURNING *`,
      params
    );
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (body.status) {
      await query(
        `INSERT INTO order_status_history (order_id, status, notes, created_by)
         SELECT id, $2::order_status, $3, $4::uuid FROM orders WHERE id = $1::uuid OR order_number = $1::text`,
        [id, body.status, body.status_note || null, auth.user?.id || null]
      );
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
