import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import {
  contractors, contractorClaims, clientClaims,
  workOrders, contractorPos, poLineItems, poPayments,
} from "../../../../../lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [cons, wos, conPos, cClaims, clClaims] = await Promise.all([
    db.select().from(contractors).where(eq(contractors.projectId, id)).orderBy(asc(contractors.sortOrder)),
    db.select().from(workOrders).where(eq(workOrders.projectId, id)).orderBy(asc(workOrders.sortOrder)),
    db.select().from(contractorPos).where(eq(contractorPos.projectId, id)),
    db.select().from(contractorClaims).where(eq(contractorClaims.projectId, id)),
    db.select().from(clientClaims).where(eq(clientClaims.projectId, id)),
  ]);

  const poIds = conPos.map(p => p.id);
  const [lineItemRows, paymentRows] = await Promise.all([
    poIds.length > 0 ? db.select().from(poLineItems).where(inArray(poLineItems.poId, poIds)) : Promise.resolve([]),
    poIds.length > 0 ? db.select().from(poPayments).where(inArray(poPayments.poId, poIds)) : Promise.resolve([]),
  ]);

  const contractorMap = Object.fromEntries(cons.map(c => [c.id, c]));
  const enrichedPos = conPos.map(p => ({
    ...p,
    contractorName: contractorMap[p.contractorId]?.name ?? "Unknown",
  }));

  return NextResponse.json({
    contractors: cons,
    workOrders: wos,
    contractorPos: enrichedPos,
    lineItems: lineItemRows,
    payments: paymentRows,
    // legacy fields kept for backward compat
    contractorClaims: cClaims,
    clientClaims: clClaims,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // ── Legacy kinds ──────────────────────────────────────────────────────
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

  // ── New kinds ─────────────────────────────────────────────────────────
  if (body.kind === "work_order") {
    const existing = await db.select({ sortOrder: workOrders.sortOrder }).from(workOrders).where(eq(workOrders.projectId, id));
    const nextSortOrder = existing.reduce((max, w) => Math.max(max, w.sortOrder), -1) + 1;
    const [wo] = await db.insert(workOrders).values({
      projectId: id,
      woNumber: body.woNumber,
      description: body.description || null,
      type: body.type || "original",
      status: body.status || "active",
      contractValue: String(body.contractValue ?? 0),
      issueDate: body.issueDate || null,
      sortOrder: nextSortOrder,
    }).returning();
    return NextResponse.json(wo);
  }

  if (body.kind === "work_orders_reorder") {
    const orderedIds: string[] = body.orderedIds ?? [];
    await Promise.all(orderedIds.map((woId, index) =>
      db.update(workOrders).set({ sortOrder: index }).where(eq(workOrders.id, woId))
    ));
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "contractor") {
    const existing = await db.select({ sortOrder: contractors.sortOrder }).from(contractors).where(eq(contractors.projectId, id));
    const nextSortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
    const [con] = await db.insert(contractors).values({
      projectId: id,
      name: body.name,
      scope: body.scope || null,
      allocatedBudget: String(body.allocatedBudget ?? 0),
      sortOrder: nextSortOrder,
    }).returning();
    return NextResponse.json(con);
  }

  if (body.kind === "contractors_reorder") {
    const orderedIds: string[] = body.orderedIds ?? [];
    await Promise.all(orderedIds.map((cId, index) =>
      db.update(contractors).set({ sortOrder: index }).where(eq(contractors.id, cId))
    ));
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "contractor_po") {
    let contractorId = body.contractorId;
    if (!contractorId && body.contractorName) {
      const [con] = await db.insert(contractors).values({
        projectId: id, name: body.contractorName, scope: body.scope || null,
      }).returning();
      contractorId = con.id;
    }
    if (!contractorId) return NextResponse.json({ error: "Contractor required" }, { status: 400 });
    const [po] = await db.insert(contractorPos).values({
      projectId: id, contractorId,
      poNumber: body.poNumber,
      scope: body.scope || null,
      poValue: String(body.poValue ?? 0),
      issueDate: body.issueDate || null,
    }).returning();
    return NextResponse.json(po);
  }

  if (body.kind === "po_line_item") {
    const [item] = await db.insert(poLineItems).values({
      poId: body.poId,
      description: body.description,
      unit: body.unit || "pcs",
      totalQty: String(body.totalQty ?? 0),
      unitRate: String(body.unitRate ?? 0),
      completedQty: String(body.completedQty ?? 0),
      sortOrder: body.sortOrder || 0,
    }).returning();
    return NextResponse.json(item);
  }

  if (body.kind === "po_payment") {
    const [pay] = await db.insert(poPayments).values({
      poId: body.poId,
      paymentDate: body.paymentDate || null,
      amount: String(body.amount),
      invoiceRef: body.invoiceRef || null,
      notes: body.notes || null,
    }).returning();
    return NextResponse.json(pay);
  }

  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}
