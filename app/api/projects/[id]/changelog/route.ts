import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { changeLogEntries, changeLogItems } from "../../../../../lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const entries = await db.select().from(changeLogEntries).where(eq(changeLogEntries.projectId, id)).orderBy(desc(changeLogEntries.createdAt));
  const entryIds = entries.map(e => e.id);
  const items = entryIds.length > 0
    ? await db.select().from(changeLogItems).where(inArray(changeLogItems.entryId, entryIds))
    : [];

  return NextResponse.json({ entries, items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { weekLabel, title } = await req.json().catch(() => ({}));
  if (!weekLabel?.trim()) return NextResponse.json({ error: "Week label required" }, { status: 400 });

  const [entry] = await db.insert(changeLogEntries).values({
    projectId: id, weekLabel: weekLabel.trim(), title: title?.trim() || "New Updates",
  }).returning();

  return NextResponse.json(entry);
}
