export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';
import { users } from '../../../../lib/db/schema';
import { eq, count } from 'drizzle-orm';
import { hashPassword } from '../../../../lib/auth/password';
import { createSessionToken, SESSION_COOKIE } from '../../../../lib/auth/session';

const TEAMS = ['network', 'osp', 'finance', 'management'] as const;

export async function POST(req: NextRequest) {
  const { email, name, password, team } = await req.json().catch(() => ({}));
  if (!email || !name || !password || !team) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  if (!TEAMS.includes(team)) {
    return NextResponse.json({ error: 'Invalid team.' }, { status: 400 });
  }

  // The very first account must go through /setup and become superadmin —
  // public signup only creates regular members once that's done.
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (value === 0) {
    return NextResponse.json({ error: 'No admin account exists yet. Complete first-time setup first.' }, { status: 400 });
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: 'Email already in use.' }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email, name, passwordHash, role: 'member', team,
  }).returning();

  const token = createSessionToken({ id: user.id, email: user.email, name: user.name, role: 'member', team: user.team });
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, team: user.team } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
