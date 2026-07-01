import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { planTasks } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await params;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = {};
  if ("title" in body) values.title = body.title;
  if ("isMilestone" in body) values.isMilestone = !!body.isMilestone;
  if ("status" in body) values.status = body.status;
  for (const k of ["planStart", "planEnd", "actualStart", "actualEnd"]) {
    if (k in body) values[k] = body[k] || null;
  }
  if (Object.keys(values).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
  await db.update(planTasks).set(values).where(eq(planTasks.id, taskId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await params;
  await db.delete(planTasks).where(eq(planTasks.id, taskId));
  return NextResponse.json({ ok: true });
}
