import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { changeLogItems } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { text } = await req.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const siblings = await db.select().from(changeLogItems).where(eq(changeLogItems.entryId, id));
  const [item] = await db.insert(changeLogItems).values({
    entryId: id, text: text.trim(), sortOrder: siblings.length,
  }).returning();

  return NextResponse.json(item);
}
