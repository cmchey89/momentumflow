import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { changeLogEntries } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.weekLabel !== undefined) patch.weekLabel = body.weekLabel;
  if (body.title !== undefined) patch.title = body.title;
  const [entry] = await db.update(changeLogEntries).set(patch).where(eq(changeLogEntries.id, id)).returning();
  return NextResponse.json(entry);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(changeLogEntries).where(eq(changeLogEntries.id, id));
  return NextResponse.json({ ok: true });
}
