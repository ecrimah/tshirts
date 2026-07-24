import { NextResponse } from 'next/server';
import {
  attachSession,
  authenticateWithPassword,
  sessionTokenForUser,
} from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const result = await authenticateWithPassword(email, password);
    if (!result.authenticated || !result.user) {
      return NextResponse.json({ error: result.error || 'Login failed' }, { status: 401 });
    }

    const token = await sessionTokenForUser(result.user);
    const response = NextResponse.json({
      user: result.user,
      access_token: token,
    });
    return attachSession(response, token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('[auth/login]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
