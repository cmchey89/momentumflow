import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { db } from "../../../../../lib/db/client";
import { messages } from "../../../../../lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await db.select().from(messages).where(eq(messages.projectId, id)).orderBy(asc(messages.createdAt));
  return NextResponse.json(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { content } = await req.json();
  const [msg] = await db.insert(messages).values({
    projectId: id,
    userId: session.user.id!,
    userName: session.user.name || session.user.email || "Unknown",
    content,
  }).returning();
  return NextResponse.json(msg);
}
