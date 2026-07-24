import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { queryOne } from '@/lib/db';
import { Resend } from 'resend';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Missing AUTH_SECRET');
  return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '')
      .trim()
      .toLowerCase();

    // Always return success to avoid account enumeration
    const okResponse = NextResponse.json({
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    });

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return okResponse;
    }

    const user = await queryOne<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );

    if (!user) {
      return okResponse;
    }

    const token = await new SignJWT({ purpose: 'password_reset', email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getSecret());

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://mamator.com').replace(/\/$/, '');
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || 'info@mamator.com';

    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: user.email,
        subject: 'Reset your Mamator password',
        html: `<p>Reset your password by opening this link (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    } else {
      console.warn('[forgot-password] RESEND_API_KEY missing; reset URL logged for ops only');
      console.warn('[forgot-password] resetUrl=', resetUrl);
    }

    return okResponse;
  } catch (err: unknown) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Unable to process request' }, { status: 500 });
  }
}
