import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

const PUBLIC_KEYS = new Set([
  'store_pricing',
  'site_name',
  'site_tagline',
  'site_logo',
  'contact_email',
  'contact_phone',
  'contact_address',
  'social_facebook',
  'social_instagram',
  'social_twitter',
  'social_tiktok',
  'social_snapchat',
  'social_youtube',
  'primary_color',
  'secondary_color',
  'currency',
  'currency_symbol',
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeModules = searchParams.get('include') === 'modules';
  const auth = await verifyAuth(request, { requireAdmin: true });
  const isAdmin = auth.authenticated;

  try {
    const keys = searchParams.get('keys')?.split(',').filter(Boolean);
    let rows;

    if (keys?.length) {
      rows = await query(`SELECT key, value, category FROM site_settings WHERE key = ANY($1::text[])`, [keys]);
    } else if (isAdmin) {
      rows = await query(`SELECT key, value, category FROM site_settings ORDER BY key`);
    } else {
      rows = await query(`SELECT key, value, category FROM site_settings WHERE key = ANY($1::text[])`, [
        [...PUBLIC_KEYS],
      ]);
    }

    const settings: Record<string, unknown> = {};
    for (const row of rows.rows) {
      if (!isAdmin && !PUBLIC_KEYS.has(row.key)) continue;
      settings[row.key] = row.value;
    }

    const payload: Record<string, unknown> = { settings };

    if (includeModules && isAdmin) {
      const modules = await query(`SELECT id, enabled FROM store_modules ORDER BY id`);
      payload.modules = modules.rows;
    }

    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error('[settings GET]', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const entries = body.settings && typeof body.settings === 'object' ? body.settings : body;

    if (!entries || typeof entries !== 'object') {
      return NextResponse.json({ error: 'settings object required' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(entries)) {
      await queryOne(
        `INSERT INTO site_settings (key, value, category, updated_at)
         VALUES ($1, $2::jsonb, COALESCE($3, 'general'), now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value), body.category || 'general']
      );
    }

    if (Array.isArray(body.modules)) {
      for (const mod of body.modules as { id: string; enabled: boolean }[]) {
        if (!mod?.id) continue;
        await query(
          `INSERT INTO store_modules (id, enabled, updated_at) VALUES ($1, $2, now())
           ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()`,
          [mod.id, !!mod.enabled]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
