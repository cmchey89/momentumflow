import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { db } from "../../../../lib/db/client";
import { tasks, projects } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.assignedTo, session.name || session.email || ""));
  const result = rows.map(r => ({ ...r.task, projectName: r.projectName ?? null }));
  return NextResponse.json(result);
}
