import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { taskComments } from "../../../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const comments = await db.select().from(taskComments).where(eq(taskComments.taskId, taskId)).orderBy(asc(taskComments.createdAt));
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const { text, imageUrl } = await req.json().catch(() => ({}));
  if (!text && !imageUrl) return NextResponse.json({ error: "Empty remark" }, { status: 400 });
  const [comment] = await db.insert(taskComments).values({
    taskId, authorId: session.id, authorName: session.name,
    text: text || null, imageUrl: imageUrl || null,
  }).returning();
  return NextResponse.json(comment);
}
