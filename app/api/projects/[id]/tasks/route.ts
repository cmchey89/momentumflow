import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { db } from "../../../../../lib/db/client";
import { tasks } from "../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await db.select().from(tasks).where(eq(tasks.projectId, id));
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { title, description, priority, assignedTo, dueDate, sourceTeam, currentTeam } = await req.json();
  const [task] = await db.insert(tasks).values({
    projectId: id,
    title,
    description,
    priority: priority ?? "medium",
    assignedTo: assignedTo || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    sourceTeam: sourceTeam || null,
    currentTeam: currentTeam || null,
    createdBy: session.user.id!,
  }).returning();
  return NextResponse.json(task);
}
