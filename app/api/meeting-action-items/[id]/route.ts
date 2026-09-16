import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { meetingActionItems } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.text !== undefined) patch.text = body.text;
  if (body.owner !== undefined) patch.owner = body.owner;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
  if (body.status !== undefined) patch.status = body.status;
  const [item] = await db.update(meetingActionItems).set(patch).where(eq(meetingActionItems.id, id)).returning();
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(meetingActionItems).where(eq(meetingActionItems.id, id));
  return NextResponse.json({ ok: true });
}
