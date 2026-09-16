import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { meetingMinutes, meetingMinuteItems } from "../../../../../lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const meetings = await db.select().from(meetingMinutes).where(eq(meetingMinutes.projectId, id)).orderBy(desc(meetingMinutes.meetingDate));
  const meetingIds = meetings.map(m => m.id);
  const items = meetingIds.length > 0
    ? await db.select().from(meetingMinuteItems).where(inArray(meetingMinuteItems.meetingId, meetingIds))
    : [];

  return NextResponse.json({ meetings, items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { meetingDate, title, attendees } = await req.json().catch(() => ({}));
  if (!meetingDate?.trim()) return NextResponse.json({ error: "Meeting date required" }, { status: 400 });

  const [meeting] = await db.insert(meetingMinutes).values({
    projectId: id, meetingDate: meetingDate.trim(), title: title?.trim() || "Meeting Minutes", attendees: attendees?.trim() || null,
  }).returning();

  return NextResponse.json(meeting);
}
