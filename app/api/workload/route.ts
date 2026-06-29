import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../lib/db/client";
import { tasks } from "../../../lib/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allTasks = await db.select({
    assignedTo: tasks.assignedTo,
    status: tasks.status,
    dueDate: tasks.dueDate,
  }).from(tasks);

  const now = new Date();
  const map: Record<string, { active: number; done: number; overdue: number; total: number }> = {};

  for (const t of allTasks) {
    const key = t.assignedTo || "Unassigned";
    if (!map[key]) map[key] = { active: 0, done: 0, overdue: 0, total: 0 };
    map[key].total++;
    if (t.status === "done") {
      map[key].done++;
    } else {
      map[key].active++;
      if (t.dueDate && new Date(t.dueDate) < now) map[key].overdue++;
    }
  }

  const result = Object.entries(map).map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json(result);
}
