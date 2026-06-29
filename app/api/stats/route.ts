import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../lib/db/client";
import { projects, tasks } from "../../../lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ value: projectCount }] = await db.select({ value: count() }).from(projects).where(eq(projects.createdBy, session.user.id!));
  const allTasks = await db.select({ status: tasks.status, handoffStatus: tasks.handoffStatus }).from(tasks);

  const taskCounts = { todo: 0, in_progress: 0, done: 0 };
  let pendingHandoffs = 0;
  for (const t of allTasks) {
    taskCounts[t.status]++;
    if (t.handoffStatus === "pending") pendingHandoffs++;
  }

  return NextResponse.json({ projects: projectCount, tasks: taskCounts, pending_handoffs: pendingHandoffs });
}
