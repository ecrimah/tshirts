import { query, queryOne } from '@/lib/db';
import { hashPassword, verifyPassword } from './password';
import {
  applySessionCookie,
  clearSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  isStaffRole,
  type SessionPayload,
} from './session';
import { NextResponse } from 'next/server';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
};

export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  role?: string;
  error?: string;
}

type DbUser = {
  id: string;
  email: string;
  encrypted_password: string | null;
  role: string | null;
  full_name: string | null;
};

async function loadUserByEmail(email: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `SELECT u.id, u.email, u.encrypted_password, p.role::text AS role, p.full_name
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE lower(u.email) = lower($1)
     LIMIT 1`,
    [email]
  );
}

async function loadUserById(id: string): Promise<DbUser | null> {
  return queryOne<DbUser>(
    `SELECT u.id, u.email, u.encrypted_password, p.role::text AS role, p.full_name
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [id]
  );
}

export async function authenticateWithPassword(email: string, password: string): Promise<AuthResult> {
  const user = await loadUserByEmail(email);
  if (!user) {
    return { authenticated: false, error: 'Invalid email or password' };
  }

  const ok = await verifyPassword(password, user.encrypted_password);
  if (!ok) {
    return { authenticated: false, error: 'Invalid email or password' };
  }

  await query(`UPDATE users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1`, [user.id]);

  const role = user.role || 'customer';
  return {
    authenticated: true,
    role,
    user: {
      id: user.id,
      email: user.email,
      role,
      full_name: user.full_name,
    },
  };
}

export async function registerUser(input: {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}): Promise<AuthResult> {
  const existing = await loadUserByEmail(input.email);
  if (existing) {
    return { authenticated: false, error: 'An account with this email already exists' };
  }

  const encrypted = await hashPassword(input.password);
  const meta = {
    full_name: input.full_name || null,
    phone: input.phone || null,
    ...(input.metadata || {}),
  };

  const created = await queryOne<{ id: string; email: string }>(
    `INSERT INTO users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
     VALUES ($1, $2, now(), $3::jsonb)
     RETURNING id, email`,
    [input.email.toLowerCase(), encrypted, JSON.stringify(meta)]
  );

  if (!created) {
    return { authenticated: false, error: 'Could not create account' };
  }

  // handle_new_user trigger creates profile; ensure name/phone if provided
  await query(
    `UPDATE profiles
     SET full_name = COALESCE($2, full_name),
         phone = COALESCE($3, phone),
         email = $4,
         updated_at = now()
     WHERE id = $1`,
    [created.id, input.full_name || null, input.phone || null, created.email]
  );

  const profile = await loadUserById(created.id);
  const role = profile?.role || 'customer';

  return {
    authenticated: true,
    role,
    user: {
      id: created.id,
      email: created.email,
      role,
      full_name: profile?.full_name,
    },
  };
}

export async function sessionTokenForUser(user: AuthUser): Promise<string> {
  return createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
}

export function attachSession(response: NextResponse, token: string) {
  return applySessionCookie(response, token);
}

export function detachSession(response: NextResponse) {
  return clearSessionCookie(response);
}

export async function verifyAuth(
  request: Request,
  options: { requireAdmin?: boolean } = {}
): Promise<AuthResult> {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return { authenticated: false, error: 'Missing or invalid session' };
    }

    const user = await loadUserById(session.sub);
    if (!user) {
      return { authenticated: false, error: 'User not found' };
    }

    const role = user.role || session.role || 'customer';

    if (options.requireAdmin && !isStaffRole(role)) {
      return { authenticated: false, error: 'Admin access required' };
    }

    return {
      authenticated: true,
      role,
      user: {
        id: user.id,
        email: user.email,
        role,
        full_name: user.full_name,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Auth verification failed';
    return { authenticated: false, error: message };
  }
}

export async function verifyAdminToken(token: string): Promise<AuthResult> {
  if (!token) {
    return { authenticated: false, error: 'Missing token' };
  }

  const fakeRequest = new Request('http://local/auth', {
    headers: { authorization: `Bearer ${token}` },
  });
  return verifyAuth(fakeRequest, { requireAdmin: true });
}

export type { SessionPayload };
export { getSessionFromRequest, getSessionFromCookies, isStaffRole } from './session';
