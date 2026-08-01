import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { woClaims } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.amount !== undefined) patch.amount = String(body.amount);
  if (body.claimDate !== undefined) patch.claimDate = body.claimDate || null;
  if (body.invoiceRef !== undefined) patch.invoiceRef = body.invoiceRef || null;
  if (body.notes !== undefined) patch.notes = body.notes || null;
  if (body.status !== undefined) patch.status = body.status;
  await db.update(woClaims).set(patch).where(eq(woClaims.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(woClaims).where(eq(woClaims.id, id));
  return NextResponse.json({ ok: true });
}
