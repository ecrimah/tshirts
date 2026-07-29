import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, isStaffRole, verifySessionToken } from '@/lib/auth/token';

const COOKIE_NAME = AUTH_COOKIE_NAME();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (pathname.startsWith('/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (pathname === '/admin/login') {
      return response;
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const session = await verifySessionToken(token);
      if (!session || !isStaffRole(session.role)) {
        const loginUrl = new URL('/admin/login', request.url);
        loginUrl.searchParams.set('error', session ? 'unauthorized' : 'session_expired');
        return NextResponse.redirect(loginUrl);
      }

      response.headers.set('x-user-id', session.sub);
      response.headers.set('x-user-role', session.role);
    } catch (err) {
      console.error('[Middleware] Auth check error:', err);
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/api/')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
