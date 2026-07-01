import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectStages, planTasks, projectTemplates } from "../../../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";

function diffDays(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, team, includeDurations, save } = await req.json().catch(() => ({}));

  const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, id)).orderBy(asc(projectStages.sortOrder));
  const allTasks = await db.select().from(planTasks).orderBy(asc(planTasks.sortOrder));

  const structure = {
    stages: stages.map(s => {
      const mainTasks = allTasks.filter(t => t.stageId === s.id && !t.parentId);
      return {
        name: s.name,
        durationDays: includeDurations ? diffDays(s.planStart, s.planEnd) : null,
        tasks: mainTasks.map(mt => ({
          title: mt.title,
          isMilestone: mt.isMilestone,
          durationDays: includeDurations ? diffDays(mt.planStart, mt.planEnd) : null,
          subTasks: allTasks.filter(t => t.parentId === mt.id).map(st => ({
            title: st.title,
            durationDays: includeDurations ? diffDays(st.planStart, st.planEnd) : null,
          })),
        })),
      };
    }),
  };

  if (save) {
    const [tpl] = await db.insert(projectTemplates).values({
      name: name || "Untitled template",
      team: team || null,
      structure: JSON.stringify(structure),
      createdBy: session.id,
    }).returning();
    return NextResponse.json({ template: tpl, structure });
  }

  return NextResponse.json({ structure });
}
