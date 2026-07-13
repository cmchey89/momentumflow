import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db/client";
import { taskComments } from "../../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { commentId } = await params;
  const { text } = await req.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "Empty text" }, { status: 400 });
  const [updated] = await db.update(taskComments).set({ text: text.trim() }).where(eq(taskComments.id, commentId)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { commentId } = await params;
  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return NextResponse.json({ ok: true });
}
