import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectBackground, projectFiles } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [bg] = await db.select().from(projectBackground).where(eq(projectBackground.projectId, id));
  const files = await db.select().from(projectFiles).where(eq(projectFiles.projectId, id));
  return NextResponse.json({ background: bg ?? null, files });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { why, client, poNumber, poValue, targetStart, targetEnd } = await req.json();

  const [existing] = await db.select().from(projectBackground).where(eq(projectBackground.projectId, id));
  const values = {
    why: why ?? null,
    client: client ?? null,
    poNumber: poNumber ?? null,
    poValue: poValue ? Number(poValue) : null,
    targetStart: targetStart || null,
    targetEnd: targetEnd || null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(projectBackground).set(values).where(eq(projectBackground.projectId, id));
  } else {
    await db.insert(projectBackground).values({ projectId: id, ...values });
  }
  const [bg] = await db.select().from(projectBackground).where(eq(projectBackground.projectId, id));
  return NextResponse.json(bg);
}
