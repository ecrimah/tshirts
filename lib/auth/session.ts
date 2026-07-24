import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  maxAgeSeconds,
  verifySessionToken,
  type SessionPayload,
} from './token';

export type { SessionPayload };
export { createSessionToken, verifySessionToken, isStaffRole } from './token';

export function sessionCookieOptions(maxAge = maxAgeSeconds()) {
  return {
    name: AUTH_COOKIE_NAME(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function applySessionCookie(response: NextResponse, token: string) {
  const opts = sessionCookieOptions();
  response.cookies.set(opts.name, token, opts);
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  const opts = sessionCookieOptions(0);
  response.cookies.set(opts.name, '', { ...opts, maxAge: 0 });
  return response;
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME())?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(request: NextRequest | Request): Promise<SessionPayload | null> {
  const cookieName = AUTH_COOKIE_NAME();

  if (request instanceof NextRequest) {
    const fromCookie = request.cookies.get(cookieName)?.value;
    if (fromCookie) {
      const session = await verifySessionToken(fromCookie);
      if (session) return session;
    }
  } else {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match?.[1]) {
      const session = await verifySessionToken(decodeURIComponent(match[1]));
      if (session) return session;
    }
  }

  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.replace(/^Bearer\s+/i, '');
  if (bearer) {
    return verifySessionToken(bearer);
  }

  return null;
}
