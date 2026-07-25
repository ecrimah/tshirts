import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

type OrderStats = {
  orders: number;
  totalSpent: number;
  lastOrder: string | null;
};

function bumpStats(map: Map<string, OrderStats>, key: string, order: {
  status: string | null;
  total: string | number | null;
  created_at: string;
}) {
  if (!key) return;
  const cancelled = order.status === 'cancelled';
  const orderTotal = cancelled ? 0 : Number(order.total || 0);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      orders: cancelled ? 0 : 1,
      totalSpent: orderTotal,
      lastOrder: cancelled ? null : order.created_at,
    });
    return;
  }
  if (!cancelled) {
    existing.orders += 1;
    existing.totalSpent += orderTotal;
    if (!existing.lastOrder || order.created_at > existing.lastOrder) {
      existing.lastOrder = order.created_at;
    }
  }
}

function mergeStats(
  byUser: OrderStats | undefined,
  byEmail: OrderStats | undefined
): OrderStats {
  if (byUser && byEmail && byUser !== byEmail) {
    return {
      orders: Math.max(byUser.orders, byEmail.orders),
      totalSpent: Math.max(byUser.totalSpent, byEmail.totalSpent),
      lastOrder:
        (byUser.lastOrder || '') >= (byEmail.lastOrder || '')
          ? byUser.lastOrder
          : byEmail.lastOrder,
    };
  }
  return byUser || byEmail || { orders: 0, totalSpent: 0, lastOrder: null };
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 500);
  const search = searchParams.get('q')?.trim();

  try {
    const customerParams: unknown[] = [];
    let where = '';
    if (search) {
      customerParams.push(`%${search}%`);
      where = `WHERE c.email ILIKE $1 OR c.full_name ILIKE $1 OR c.phone ILIKE $1`;
    }
    customerParams.push(limit);

    const customersResult = await query(
      `SELECT c.*,
        p.full_name AS profile_name,
        p.email AS profile_email
       FROM customers c
       LEFT JOIN profiles p ON p.id = c.user_id
       ${where}
       ORDER BY c.last_order_at DESC NULLS LAST, c.created_at DESC
       LIMIT $${customerParams.length}`,
      customerParams
    );

    const ordersResult = await query<{
      id: string;
      user_id: string | null;
      email: string | null;
      total: string | number | null;
      created_at: string;
      status: string | null;
      shipping_address: Record<string, unknown> | null;
    }>(
      `SELECT id, user_id, email, total, created_at, status, shipping_address
       FROM orders
       ORDER BY created_at DESC
       LIMIT 5000`
    );

    const statsByEmail = new Map<string, OrderStats>();
    const statsByUserId = new Map<string, OrderStats>();
    const guestHints = new Map<string, { name?: string; phone?: string }>();

    for (const order of ordersResult.rows) {
      const emailKey = (order.email || '').toLowerCase().trim();
      bumpStats(statsByEmail, emailKey, order);
      if (order.user_id) bumpStats(statsByUserId, order.user_id, order);

      if (emailKey) {
        const addr = (order.shipping_address || {}) as Record<string, string>;
        const fullName =
          addr.full_name ||
          `${addr.firstName || addr.first_name || ''} ${addr.lastName || addr.last_name || ''}`.trim();
        const hint = guestHints.get(emailKey) || {};
        if (fullName && !hint.name) hint.name = fullName;
        if ((addr.phone || order.email) && !hint.phone) hint.phone = addr.phone;
        guestHints.set(emailKey, hint);
      }
    }

    const seenEmails = new Set<string>();
    const processed: Record<string, unknown>[] = customersResult.rows.map((customer) => {
      const emailKey = customer.email ? String(customer.email).toLowerCase().trim() : '';
      if (emailKey) seenEmails.add(emailKey);
      const stats = mergeStats(
        customer.user_id ? statsByUserId.get(String(customer.user_id)) : undefined,
        emailKey ? statsByEmail.get(emailKey) : undefined
      );
      return {
        ...customer,
        total_orders: stats.orders,
        total_spent: stats.totalSpent,
        last_order_at: stats.lastOrder || customer.last_order_at,
      };
    });

    // Append guest shoppers who have orders but no customers row
    for (const [email, stats] of statsByEmail.entries()) {
      if (!email || seenEmails.has(email) || stats.orders === 0) continue;
      const hint = guestHints.get(email) || {};
      processed.push({
        id: `guest:${email}`,
        email,
        full_name: hint.name || 'Guest',
        phone: hint.phone || null,
        user_id: null,
        tags: ['guest'],
        total_orders: stats.orders,
        total_spent: stats.totalSpent,
        last_order_at: stats.lastOrder,
        created_at: stats.lastOrder,
        profile_name: null,
        profile_email: null,
      });
    }

    processed.sort((a, b) => {
      const aTime = a.last_order_at ? new Date(String(a.last_order_at)).getTime() : 0;
      const bTime = b.last_order_at ? new Date(String(b.last_order_at)).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json(processed.slice(0, limit));
  } catch (err: unknown) {
    console.error('[admin/customers]', err);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}
