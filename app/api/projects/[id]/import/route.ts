import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectStages, planTasks, projectTemplates } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

interface TplSubTask { title: string; durationDays: number | null }
interface TplTask { title: string; isMilestone?: boolean; durationDays: number | null; subTasks: TplSubTask[] }
interface TplStage { name: string; durationDays: number | null; tasks: TplTask[] }
interface TplStructure { stages: TplStage[] }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { templateId, structure, startDate } = await req.json().catch(() => ({}));

  let parsed: TplStructure | null = structure ?? null;
  if (!parsed && templateId) {
    const [tpl] = await db.select().from(projectTemplates).where(eq(projectTemplates.id, templateId));
    if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    parsed = JSON.parse(tpl.structure);
  }
  if (!parsed) return NextResponse.json({ error: "No template structure provided" }, { status: 400 });

  // startDate === null means the user chose "No dates" -- skip all date
  // math and import bare structure only, to be scheduled later.
  const useDates = startDate !== null;
  const existingStages = await db.select().from(projectStages).where(eq(projectStages.projectId, id));
  let cursor = useDates ? (startDate || new Date().toISOString().slice(0, 10)) : "";
  let sortOrder = existingStages.length;
  let stagesCreated = 0, mainCreated = 0, subCreated = 0;

  for (const stage of parsed.stages) {
    const stageStart = cursor;
    const stageDur = stage.durationDays ?? stage.tasks.reduce((sum, t) => sum + (t.durationDays ?? 1), 0);
    const stageEnd = useDates ? addDays(stageStart, Math.max(stageDur, 1)) : "";

    const [createdStage] = await db.insert(projectStages).values({
      projectId: id, name: stage.name, sortOrder: sortOrder++,
      planStart: useDates ? stageStart : null, planEnd: useDates ? stageEnd : null,
    }).returning();
    stagesCreated++;

    let taskCursor = stageStart;
    let taskSort = 0;
    for (const task of stage.tasks) {
      const taskDur = task.durationDays ?? 1;
      const taskStart = taskCursor;
      const taskEnd = useDates ? addDays(taskStart, taskDur) : "";

      const [createdTask] = await db.insert(planTasks).values({
        stageId: createdStage.id, parentId: null,
        title: task.title, isMilestone: !!task.isMilestone, sortOrder: taskSort++,
        planStart: useDates ? taskStart : null, planEnd: useDates ? taskEnd : null,
      }).returning();
      mainCreated++;

      let subCursor = taskStart;
      let subSort = 0;
      for (const sub of task.subTasks) {
        const subDur = sub.durationDays ?? 1;
        const subStart = subCursor;
        const subEnd = useDates ? addDays(subStart, subDur) : "";
        await db.insert(planTasks).values({
          stageId: createdStage.id, parentId: createdTask.id,
          title: sub.title, isMilestone: false, sortOrder: subSort++,
          planStart: useDates ? subStart : null, planEnd: useDates ? subEnd : null,
        });
        subCreated++;
        subCursor = subEnd;
      }
      taskCursor = taskEnd;
    }
    cursor = stageEnd;
  }

  return NextResponse.json({ ok: true, stagesCreated, mainCreated, subCreated });
}
