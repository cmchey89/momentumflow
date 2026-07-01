import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { contractorClaims, clientClaims } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { claimId } = await params;
  const { kind, status } = await req.json().catch(() => ({}));
  if (!status) return NextResponse.json({ error: "Missing status" }, { status: 400 });

  const table = kind === "client" ? clientClaims : contractorClaims;
  await db.update(table).set({ status }).where(eq(table.id, claimId));
  return NextResponse.json({ ok: true });
}
