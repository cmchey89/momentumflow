import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { db } from "../../../lib/db/client";
import { meetingMinutes, meetingMinuteItems } from "../../../lib/db/schema";
import { inArray, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetings = await db.select().from(meetingMinutes).orderBy(desc(meetingMinutes.meetingDate));
  const meetingIds = meetings.map(m => m.id);
  const items = meetingIds.length > 0
    ? await db.select().from(meetingMinuteItems).where(inArray(meetingMinuteItems.meetingId, meetingIds))
    : [];

  return NextResponse.json({ meetings, items });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingDate, title, attendees } = await req.json().catch(() => ({}));
  if (!meetingDate?.trim()) return NextResponse.json({ error: "Meeting date required" }, { status: 400 });

  const [meeting] = await db.insert(meetingMinutes).values({
    meetingDate: meetingDate.trim(), title: title?.trim() || "Meeting Minutes", attendees: attendees?.trim() || null,
  }).returning();

  return NextResponse.json(meeting);
}
