import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { changeLogItems } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { text } = await req.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });
  const [item] = await db.update(changeLogItems).set({ text: text.trim() }).where(eq(changeLogItems.id, id)).returning();
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(changeLogItems).where(eq(changeLogItems.id, id));
  return NextResponse.json({ ok: true });
}
