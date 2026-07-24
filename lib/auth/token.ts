import { SignJWT, jwtVerify } from 'jose';

export type SessionPayload = {
  sub: string;
  email: string;
  role: string;
};

export const AUTH_COOKIE_NAME = () => process.env.AUTH_COOKIE_NAME || 'mamator_session';

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('Missing AUTH_SECRET — set it in .env.local (see .env.example)');
  }
  return new TextEncoder().encode(secret);
}

export function maxAgeSeconds() {
  const days = Number(process.env.AUTH_COOKIE_MAX_AGE_DAYS || '7');
  return Math.max(1, days) * 24 * 60 * 60;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds()}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: typeof payload.role === 'string' ? payload.role : 'customer',
    };
  } catch {
    return null;
  }
}

export function isStaffRole(role?: string | null) {
  return role === 'admin' || role === 'staff';
}
