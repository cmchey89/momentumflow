import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { contractors, contractorClaims, clientClaims } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [cons, cClaims, clClaims] = await Promise.all([
    db.select().from(contractors).where(eq(contractors.projectId, id)),
    db.select().from(contractorClaims).where(eq(contractorClaims.projectId, id)),
    db.select().from(clientClaims).where(eq(clientClaims.projectId, id)),
  ]);
  return NextResponse.json({ contractors: cons, contractorClaims: cClaims, clientClaims: clClaims });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.kind === "contractor") {
    const [c] = await db.insert(contractors).values({ projectId: id, name: body.name, scope: body.scope || null }).returning();
    return NextResponse.json(c);
  }
  if (body.kind === "contractor_claim") {
    const [c] = await db.insert(contractorClaims).values({
      projectId: id, contractorId: body.contractorId, stageId: body.stageId || null,
      amount: Number(body.amount), invoiceNo: body.invoiceNo || null,
      status: body.status || "pending", claimDate: body.claimDate || null,
    }).returning();
    return NextResponse.json(c);
  }
  if (body.kind === "client_claim") {
    const [c] = await db.insert(clientClaims).values({
      projectId: id, stageId: body.stageId || null,
      amount: Number(body.amount), invoiceNo: body.invoiceNo || null,
      status: body.status || "pending", claimDate: body.claimDate || null,
    }).returning();
    return NextResponse.json(c);
  }
  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}
