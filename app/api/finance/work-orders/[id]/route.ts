import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { workOrders } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.status !== undefined) patch.status = body.status;
  if (body.contractValue !== undefined) patch.contractValue = String(body.contractValue);
  if (body.description !== undefined) patch.description = body.description;
  if (body.woNumber !== undefined) patch.woNumber = body.woNumber;
  if (body.issueDate !== undefined) patch.issueDate = body.issueDate || null;
  await db.update(workOrders).set(patch).where(eq(workOrders.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(workOrders).where(eq(workOrders.id, id));
  return NextResponse.json({ ok: true });
}
