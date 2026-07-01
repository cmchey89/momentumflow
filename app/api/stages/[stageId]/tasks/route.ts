import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { planTasks } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stageId } = await params;
  const { title, parentId, planStart, planEnd, isMilestone } = await req.json().catch(() => ({}));
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const siblings = await db.select().from(planTasks).where(eq(planTasks.stageId, stageId));
  const [task] = await db.insert(planTasks).values({
    stageId,
    parentId: parentId || null,
    title,
    isMilestone: !!isMilestone,
    sortOrder: siblings.length,
    planStart: planStart || null,
    planEnd: planEnd || null,
  }).returning();
  return NextResponse.json(task);
}
