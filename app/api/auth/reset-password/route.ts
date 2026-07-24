import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Missing AUTH_SECRET');
  return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token || '');
    const password = String(body.password || '');

    if (!token || password.length < 6) {
      return NextResponse.json({ error: 'Valid token and password (min 6 chars) required' }, { status: 400 });
    }

    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'password_reset' || !payload.sub) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }

    const encrypted = await hashPassword(password);
    const result = await query(
      `UPDATE users SET encrypted_password = $2, updated_at = now() WHERE id = $1::uuid RETURNING id`,
      [payload.sub, encrypted]
    );

    if (!result.rowCount) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
  }
}
