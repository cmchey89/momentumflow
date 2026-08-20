import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from '../../../lib/auth/session';
import { db } from "../../../lib/db/client";
import { projects, projectMembers } from "../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db.select().from(projects).where(eq(projects.createdBy, session.id)).orderBy(asc(projects.sortOrder));
  return NextResponse.json(owned);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  const existing = await db.select({ sortOrder: projects.sortOrder }).from(projects).where(eq(projects.createdBy, session.id));
  const nextSortOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
  const [project] = await db.insert(projects).values({
    name, description, createdBy: session.id, sortOrder: nextSortOrder,
  }).returning();

  await db.insert(projectMembers).values({
    projectId: project.id, userId: session.id, role: "owner",
  });

  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderedIds } = await req.json().catch(() => ({}));
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: "orderedIds required" }, { status: 400 });

  await Promise.all(orderedIds.map((id: string, index: number) =>
    db.update(projects).set({ sortOrder: index }).where(eq(projects.id, id))
  ));
  return NextResponse.json({ ok: true });
}
