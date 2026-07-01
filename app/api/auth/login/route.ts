export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';
import { users } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '../../../../lib/auth/password';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/auth/session';
import { checkRateLimit, clientIp } from '../../../../lib/auth/rateLimit';

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const genericError = NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  if (!user) return genericError;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError;

  const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role as 'superadmin' | 'manager' | 'member', team: user.team });

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
