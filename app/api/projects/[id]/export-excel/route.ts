import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projects, projectStages, planTasks } from "../../../../../lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { buildSinglePlanWorkbook } from "../../../../../lib/excel/generatePlanExcel";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, id));
  const stageIds = stages.map(s => s.id);
  const tasks = stageIds.length > 0 ? await db.select().from(planTasks).where(inArray(planTasks.stageId, stageIds)) : [];

  const buffer = buildSinglePlanWorkbook(project.name, stages, tasks);
  const filename = `${project.name.replace(/[\\/:*?"<>|]/g, " ")} - Plan.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
