import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { meetingMinutes } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.meetingDate !== undefined) patch.meetingDate = body.meetingDate;
  if (body.title !== undefined) patch.title = body.title;
  if (body.attendees !== undefined) patch.attendees = body.attendees;
  const [meeting] = await db.update(meetingMinutes).set(patch).where(eq(meetingMinutes.id, id)).returning();
  return NextResponse.json(meeting);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(meetingMinutes).where(eq(meetingMinutes.id, id));
  return NextResponse.json({ ok: true });
}
