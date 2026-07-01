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

  const { email, name, password, role, team } = await req.json().catch(() => ({}));
  if (!email || !name || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // Managers can only create members, and only for their own team
  if (session.role === 'manager') {
    if (role && role !== 'member') return NextResponse.json({ error: 'Managers can only create members' }, { status: 403 });
    if (team !== session.team) return NextResponse.json({ error: 'Managers can only add members to their own team' }, { status: 403 });
  }

  const assignedRole = session.role === 'manager' ? 'member' : (role ?? 'member');
  const assignedTeam = team ?? null;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email, name, passwordHash,
    role: assignedRole as 'superadmin' | 'manager' | 'member',
    team: assignedTeam,
  }).returning();

  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, team: user.team } });
}

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session || (session.role !== 'superadmin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let query = db.select({
    id: users.id, email: users.email, name: users.name,
    role: users.role, team: users.team, createdAt: users.createdAt,
  }).from(users);

  // Managers only see their own team
  if (session.role === 'manager') {
    const allUsers = await db.select({
      id: users.id, email: users.email, name: users.name,
      role: users.role, team: users.team, createdAt: users.createdAt,
    }).from(users).where(eq(users.team, session.team as "network" | "osp" | "finance" | "management"));
    return NextResponse.json(allUsers);
  }

  const allUsers = await query;
  return NextResponse.json(allUsers);
}
