import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../../lib/auth/session";
import { db } from "../../../../../../lib/db/client";
import { personalTaskAttachments } from "../../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { attachmentId } = await params;
  await db.delete(personalTaskAttachments).where(eq(personalTaskAttachments.id, attachmentId));
  return NextResponse.json({ ok: true });
}
