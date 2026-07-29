import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { contractorPos } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.poValue !== undefined) patch.poValue = String(body.poValue);
  if (body.scope !== undefined) patch.scope = body.scope || null;
  if (body.poNumber !== undefined) patch.poNumber = body.poNumber;
  if (body.issueDate !== undefined) patch.issueDate = body.issueDate || null;
  await db.update(contractorPos).set(patch).where(eq(contractorPos.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(contractorPos).where(eq(contractorPos.id, id));
  return NextResponse.json({ ok: true });
}
