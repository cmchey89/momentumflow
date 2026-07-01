import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'teamhub_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'manager' | 'member';
  team?: string | null;
}

function getSecret(): string {
  const s = process.env.SESSION_JWT_SECRET;
  if (!s) throw new Error('SESSION_JWT_SECRET is not set.');
  return s;
}

export function createSessionToken(user: SessionUser): string {
  return jwt.sign(user, getSecret(), { expiresIn: '7d' });
}

export function getSessionFromRequest(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret()) as SessionUser;
  } catch {
    return null;
  }
}
