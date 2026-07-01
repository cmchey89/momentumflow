import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { projectStages } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stageId } = await params;
  const body = await req.json().catch(() => ({}));
  const values: Record<string, unknown> = {};
  for (const k of ["name", "status", "planStart", "planEnd", "actualStart", "actualEnd"]) {
    if (k in body) values[k] = body[k] || null;
  }
  if (Object.keys(values).length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });
  await db.update(projectStages).set(values).where(eq(projectStages.id, stageId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stageId } = await params;
  await db.delete(projectStages).where(eq(projectStages.id, stageId));
  return NextResponse.json({ ok: true });
}
