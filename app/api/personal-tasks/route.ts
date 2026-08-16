import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { db } from "../../../lib/db/client";
import { personalTasks, personalTaskAttachments } from "../../../lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myTasks = await db.select().from(personalTasks).where(eq(personalTasks.userId, session.id)).orderBy(asc(personalTasks.createdAt));
  const taskIds = myTasks.map(t => t.id);
  const attachments = taskIds.length > 0
    ? await db.select().from(personalTaskAttachments).where(inArray(personalTaskAttachments.taskId, taskIds))
    : [];

  return NextResponse.json({ tasks: myTasks, attachments });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const [task] = await db.insert(personalTasks).values({
    userId: session.id,
    title: body.title.trim(),
    notes: body.notes || null,
    priority: body.priority || "medium",
    status: body.status || "todo",
    dueDate: body.dueDate || null,
  }).returning();

  return NextResponse.json(task);
}
