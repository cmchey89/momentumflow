import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectStages, planTasks } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

interface BulkSubTask { title: string; planStart: string | null; planEnd: string | null }
interface BulkTask { title: string; planStart: string | null; planEnd: string | null; subTasks: BulkSubTask[] }
interface BulkStage { name: string; tasks: BulkTask[] }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { stages } = await req.json().catch(() => ({ stages: [] as BulkStage[] })) as { stages: BulkStage[] };
  if (!Array.isArray(stages) || stages.length === 0) return NextResponse.json({ error: "No stages provided" }, { status: 400 });

  const existing = await db.select().from(projectStages).where(eq(projectStages.projectId, id));
  let sortOrder = existing.length;
  let stagesCreated = 0, mainCreated = 0, subCreated = 0;

  for (const stage of stages) {
    const allDates = stage.tasks.flatMap(t => [t.planStart, t.planEnd]).filter((d): d is string => !!d);
    const stagePlanStart = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : null;
    const stagePlanEnd = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : null;

    const [createdStage] = await db.insert(projectStages).values({
      projectId: id, name: stage.name, sortOrder: sortOrder++,
      planStart: stagePlanStart, planEnd: stagePlanEnd,
    }).returning();
    stagesCreated++;

    let taskSort = 0;
    for (const task of stage.tasks) {
      const [createdTask] = await db.insert(planTasks).values({
        stageId: createdStage.id, parentId: null,
        title: task.title, sortOrder: taskSort++,
        planStart: task.planStart, planEnd: task.planEnd,
      }).returning();
      mainCreated++;

      let subSort = 0;
      for (const sub of task.subTasks) {
        await db.insert(planTasks).values({
          stageId: createdStage.id, parentId: createdTask.id,
          title: sub.title, sortOrder: subSort++,
          planStart: sub.planStart, planEnd: sub.planEnd,
        });
        subCreated++;
      }
    }
  }

  return NextResponse.json({ ok: true, stagesCreated, mainCreated, subCreated });
}
