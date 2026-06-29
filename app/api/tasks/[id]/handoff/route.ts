import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { db } from "../../../../../lib/db/client";
import { tasks, taskHandoffs } from "../../../../../lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET — fetch handoff history for a task
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const history = await db.select().from(taskHandoffs)
    .where(eq(taskHandoffs.taskId, id))
    .orderBy(desc(taskHandoffs.createdAt));
  return NextResponse.json(history);
}

// POST — send task to another team (handoff)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { toTeam, note } = await req.json();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const fromTeam = task.currentTeam || task.sourceTeam;
  if (!fromTeam) return NextResponse.json({ error: "Task has no source team set" }, { status: 400 });

  const [handoff] = await db.insert(taskHandoffs).values({
    taskId: id,
    fromTeam,
    toTeam,
    note: note || null,
    sentBy: session.user.name || session.user.email || "Unknown",
  }).returning();

  await db.update(tasks).set({
    currentTeam: toTeam,
    handoffStatus: "pending",
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  return NextResponse.json(handoff);
}

// PATCH — resolve or return a handoff (by the receiving team)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { handoffId, action, resolvedNote } = await req.json();
  // action: "resolve" | "return"

  const [handoff] = await db.select().from(taskHandoffs).where(eq(taskHandoffs.id, handoffId));
  if (!handoff) return NextResponse.json({ error: "Handoff not found" }, { status: 404 });

  const newStatus = action === "resolve" ? "resolved" : "returned";
  await db.update(taskHandoffs).set({
    status: newStatus,
    resolvedNote: resolvedNote || null,
    resolvedBy: session.user.name || session.user.email || "Unknown",
    resolvedAt: new Date(),
  }).where(eq(taskHandoffs.id, handoffId));

  if (action === "return") {
    // Send back to original sender's team
    await db.update(tasks).set({
      currentTeam: handoff.fromTeam,
      handoffStatus: "returned",
      updatedAt: new Date(),
    }).where(eq(tasks.id, id));
  } else {
    // Resolved — mark task active at current team
    await db.update(tasks).set({
      handoffStatus: "active",
      updatedAt: new Date(),
    }).where(eq(tasks.id, id));
  }

  return NextResponse.json({ ok: true });
}
