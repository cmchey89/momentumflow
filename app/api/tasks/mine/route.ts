import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { db } from "../../../../lib/db/client";
import { tasks } from "../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await db.select().from(tasks).where(eq(tasks.assignedTo, session.user.name || session.user.email || ""));
  return NextResponse.json(result);
}
