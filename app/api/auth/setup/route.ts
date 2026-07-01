export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';
import { users } from '../../../../lib/db/schema';
import { hashPassword } from '../../../../lib/auth/password';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/auth/session';
import { count } from 'drizzle-orm';

// Check if setup is allowed (zero users in DB)
export async function GET() {
  const [{ value }] = await db.select({ value: count() }).from(users);
  return NextResponse.json({ allowed: value === 0 });
}

// Create the first admin account — only works when DB has zero users
export async function POST(req: NextRequest) {
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (value > 0) {
    return NextResponse.json({ error: 'Setup already completed.' }, { status: 403 });
  }

  const { email, name, password } = await req.json().catch(() => ({}));
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email, name, passwordHash, role: 'superadmin',
  }).returning();

  const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: 'superadmin', team: null });
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
