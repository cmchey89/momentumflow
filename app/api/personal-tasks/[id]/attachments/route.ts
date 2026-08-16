import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { personalTaskAttachments } from "../../../../../lib/db/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, url, pathname } = await req.json().catch(() => ({}));
  if (!name || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const [attachment] = await db.insert(personalTaskAttachments).values({
    taskId: id, name, url, pathname: pathname ?? null,
  }).returning();

  return NextResponse.json(attachment);
}
