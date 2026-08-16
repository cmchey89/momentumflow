import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { personalTasks } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.notes !== undefined) patch.notes = body.notes || null;
  if (body.priority !== undefined) patch.priority = body.priority;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate || null;
  if (body.status !== undefined) {
    patch.status = body.status;
    patch.completedAt = body.status === "done" ? new Date() : null;
  }

  const [task] = await db.update(personalTasks).set(patch).where(eq(personalTasks.id, id)).returning();
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(personalTasks).where(eq(personalTasks.id, id));
  return NextResponse.json({ ok: true });
}
