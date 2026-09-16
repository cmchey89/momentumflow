import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { db } from "../../../lib/db/client";
import { people } from "../../../lib/db/schema";
import { asc, ilike } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(people).orderBy(asc(people.name));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Case-insensitive de-dupe so "CM" and "cm" don't end up as two entries.
  const existing = await db.select().from(people).where(ilike(people.name, trimmed)).limit(1);
  if (existing.length > 0) return NextResponse.json(existing[0]);

  const [person] = await db.insert(people).values({ name: trimmed }).returning();
  return NextResponse.json(person);
}
