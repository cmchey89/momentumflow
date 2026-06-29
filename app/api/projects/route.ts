import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { db } from "../../../lib/db/client";
import { projects, projectMembers } from "../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await db.select().from(projects).where(eq(projects.createdBy, session.user.id!));
  return NextResponse.json(owned);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  const [project] = await db.insert(projects).values({
    name, description, createdBy: session.user.id!,
  }).returning();

  await db.insert(projectMembers).values({
    projectId: project.id, userId: session.user.id!, role: "owner",
  });

  return NextResponse.json(project);
}
