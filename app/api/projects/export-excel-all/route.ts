import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { projects, projectStages, planTasks } from "../../../../lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { buildAllPlansWorkbook } from "../../../../lib/excel/generatePlanExcel";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myProjects = await db.select().from(projects).where(eq(projects.createdBy, session.id)).orderBy(asc(projects.sortOrder));

  const projectData = await Promise.all(myProjects.map(async p => {
    const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, p.id));
    const stageIds = stages.map(s => s.id);
    const tasks = stageIds.length > 0 ? await db.select().from(planTasks).where(inArray(planTasks.stageId, stageIds)) : [];
    return { name: p.name, stages, tasks };
  }));

  const buffer = buildAllPlansWorkbook(projectData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="All Project Plans.xlsx"`,
    },
  });
}
