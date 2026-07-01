import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { db } from "../../../lib/db/client";
import { projectTemplates } from "../../../lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await db.select().from(projectTemplates).orderBy(desc(projectTemplates.createdAt));
  return NextResponse.json(templates);
}
