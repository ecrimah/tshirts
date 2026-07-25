import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { sendNewsletterWelcome } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const clientId = getClientIdentifier(request);
    const rate = checkRateLimit(`newsletter:${clientId}`, {
      maxRequests: 8,
      windowSeconds: 60,
    });
    if (!rate.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const raw = typeof body.email === 'string' ? body.email : '';
    const email = raw.trim().toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (email.length > 254) {
      return NextResponse.json({ error: 'Email is too long.' }, { status: 400 });
    }

    const existing = await queryOne<{ id: string; tags: string[] | null }>(
      `SELECT id, tags FROM customers WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );

    const newsletterTag = 'newsletter';
    let isNewSubscriber = false;

    if (existing?.id) {
      const tags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
      if (!tags.includes(newsletterTag)) {
        isNewSubscriber = true;
        await query(
          `UPDATE customers SET tags = $2::text[], updated_at = now() WHERE id = $1::uuid`,
          [existing.id, [...tags, newsletterTag]]
        );
      }
    } else {
      isNewSubscriber = true;
      await query(
        `INSERT INTO customers (email, full_name, tags)
         VALUES ($1, $2, $3::text[])`,
        [email, 'Newsletter subscriber', [newsletterTag]]
      );
    }

    if (isNewSubscriber) {
      try {
        await sendNewsletterWelcome(email);
      } catch (e) {
        console.error('[newsletter] welcome email failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: isNewSubscriber
        ? 'Welcome to the club! Check your inbox for your welcome offer.'
        : 'You are already subscribed. Check your inbox for past offers.',
    });
  } catch (e) {
    console.error('[newsletter] unexpected:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
