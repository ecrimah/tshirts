import { NextResponse } from 'next/server';
import { attachSession, registerUser, sessionTokenForUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const full_name = body.full_name ? String(body.full_name) : undefined;
    const phone = body.phone ? String(body.phone) : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const result = await registerUser({
      email,
      password,
      full_name,
      phone,
      metadata: body.metadata || {},
    });

    if (!result.authenticated || !result.user) {
      return NextResponse.json({ error: result.error || 'Signup failed' }, { status: 400 });
    }

    const token = await sessionTokenForUser(result.user);
    const response = NextResponse.json({
      user: result.user,
      access_token: token,
    });
    return attachSession(response, token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signup failed';
    console.error('[auth/signup]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
