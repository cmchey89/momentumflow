export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db/client';
import { users } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../../../lib/auth/password';
import { getSessionFromRequest } from '../../../../lib/auth/session';

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'superadmin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId, newPassword } = await req.json().catch(() => ({}));
  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
