import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectStages, planTasks } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

type BulkStatus = "pending" | "in_progress" | "done";
interface BulkSubTask { title: string; planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null; status?: BulkStatus }
interface BulkTask { title: string; planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null; status?: BulkStatus; subTasks: BulkSubTask[] }
interface BulkStage { name: string; tasks: BulkTask[] }

function inferStatus(actualStart: string | null, actualEnd: string | null): "pending" | "in_progress" | "done" {
  if (actualEnd) return "done";
  if (actualStart) return "in_progress";
  return "pending";
}

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
    const planDates = stage.tasks.flatMap(t => [t.planStart, t.planEnd]).filter((d): d is string => !!d);
    const actualDates = stage.tasks.flatMap(t => [t.actualStart, t.actualEnd]).filter((d): d is string => !!d);
    const stagePlanStart = planDates.length ? planDates.reduce((a, b) => (a < b ? a : b)) : null;
    const stagePlanEnd = planDates.length ? planDates.reduce((a, b) => (a > b ? a : b)) : null;
    const stageActualStart = actualDates.length ? actualDates.reduce((a, b) => (a < b ? a : b)) : null;
    const stageActualEnd = actualDates.length ? actualDates.reduce((a, b) => (a > b ? a : b)) : null;

    const [createdStage] = await db.insert(projectStages).values({
      projectId: id, name: stage.name, sortOrder: sortOrder++,
      planStart: stagePlanStart, planEnd: stagePlanEnd,
      actualStart: stageActualStart, actualEnd: stageActualEnd,
    }).returning();
    stagesCreated++;

    let taskSort = 0;
    for (const task of stage.tasks) {
      const [createdTask] = await db.insert(planTasks).values({
        stageId: createdStage.id, parentId: null,
        title: task.title, sortOrder: taskSort++,
        planStart: task.planStart, planEnd: task.planEnd,
        actualStart: task.actualStart, actualEnd: task.actualEnd,
        status: task.status ?? inferStatus(task.actualStart, task.actualEnd),
      }).returning();
      mainCreated++;

      let subSort = 0;
      for (const sub of task.subTasks) {
        await db.insert(planTasks).values({
          stageId: createdStage.id, parentId: createdTask.id,
          title: sub.title, sortOrder: subSort++,
          planStart: sub.planStart, planEnd: sub.planEnd,
          actualStart: sub.actualStart, actualEnd: sub.actualEnd,
          status: sub.status ?? inferStatus(sub.actualStart, sub.actualEnd),
        });
        subCreated++;
      }
    }
  }

  return NextResponse.json({ ok: true, stagesCreated, mainCreated, subCreated });
}
