import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../lib/db/client";
import { tasks, projects } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assignedTo: tasks.assignedTo,
      dueDate: tasks.dueDate,
      sourceTeam: tasks.sourceTeam,
      currentTeam: tasks.currentTeam,
      handoffStatus: tasks.handoffStatus,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      projectId: tasks.projectId,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id));

  return NextResponse.json(allTasks);
}
