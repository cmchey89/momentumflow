import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectStages, planTasks, taskComments } from "../../../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, id)).orderBy(asc(projectStages.sortOrder));
  const stageIds = stages.map(s => s.id);

  let tasks: (typeof planTasks.$inferSelect)[] = [];
  if (stageIds.length) {
    tasks = await db.select().from(planTasks).orderBy(asc(planTasks.sortOrder));
    tasks = tasks.filter(t => stageIds.includes(t.stageId));
  }

  const taskIds = tasks.map(t => t.id);
  let comments: (typeof taskComments.$inferSelect)[] = [];
  if (taskIds.length) {
    comments = await db.select().from(taskComments).orderBy(asc(taskComments.createdAt));
    comments = comments.filter(c => taskIds.includes(c.taskId));
  }

  return NextResponse.json({ stages, tasks, comments });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, planStart, planEnd } = await req.json().catch(() => ({}));
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const existing = await db.select().from(projectStages).where(eq(projectStages.projectId, id));
  const [stage] = await db.insert(projectStages).values({
    projectId: id, name, sortOrder: existing.length,
    planStart: planStart || null, planEnd: planEnd || null,
  }).returning();
  return NextResponse.json(stage);
}
