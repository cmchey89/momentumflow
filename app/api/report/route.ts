import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../lib/db/client";
import { tasks } from "../../../lib/db/schema";
import { gte, lte, and } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [];
  if (from) conditions.push(gte(tasks.createdAt, new Date(from)));
  if (to) conditions.push(lte(tasks.createdAt, new Date(to)));

  const allTasks = await db.select({
    assignedTo: tasks.assignedTo,
    status: tasks.status,
    sourceTeam: tasks.sourceTeam,
    createdAt: tasks.createdAt,
  }).from(tasks).where(conditions.length ? and(...conditions) : undefined);

  const map: Record<string, { total: number; done: number; in_progress: number; todo: number; teams: Set<string> }> = {};

  for (const t of allTasks) {
    const key = t.assignedTo || "Unassigned";
    if (!map[key]) map[key] = { total: 0, done: 0, in_progress: 0, todo: 0, teams: new Set() };
    map[key].total++;
    map[key][t.status as "done" | "in_progress" | "todo"]++;
    if (t.sourceTeam) map[key].teams.add(t.sourceTeam);
  }

  const result = Object.entries(map).map(([name, d]) => ({
    name,
    total: d.total,
    done: d.done,
    in_progress: d.in_progress,
    todo: d.todo,
    completionRate: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
    teamsServed: Array.from(d.teams),
  })).sort((a, b) => b.done - a.done);

  return NextResponse.json(result);
}
