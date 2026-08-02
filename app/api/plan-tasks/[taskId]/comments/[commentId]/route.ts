import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db/client";
import { taskComments } from "../../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { commentId } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.text !== undefined) {
    if (!body.text?.trim()) return NextResponse.json({ error: "Empty text" }, { status: 400 });
    patch.text = body.text.trim();
  }
  if (body.flagged !== undefined) patch.flagged = Boolean(body.flagged);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const [updated] = await db.update(taskComments).set(patch).where(eq(taskComments.id, commentId)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { commentId } = await params;
  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return NextResponse.json({ ok: true });
}
