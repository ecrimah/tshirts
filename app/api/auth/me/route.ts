import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  const result = await verifyAuth(request);
  if (!result.authenticated || !result.user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: result.user });
}
