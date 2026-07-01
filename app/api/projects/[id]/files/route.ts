import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/auth/session";
import { db } from "../../../../../lib/db/client";
import { projectFiles } from "../../../../../lib/db/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, url } = await req.json().catch(() => ({}));
  if (!name || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const [file] = await db.insert(projectFiles).values({
    projectId: id, name, url, uploadedBy: session.id,
  }).returning();
  return NextResponse.json(file);
}
