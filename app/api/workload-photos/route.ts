import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/auth/session";
import { db } from "../../../lib/db/client";
import { workloadPhotos } from "../../../lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const photos = await db.select().from(workloadPhotos).orderBy(desc(workloadPhotos.createdAt));
  return NextResponse.json(photos);
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, url, pathname } = await req.json().catch(() => ({}));
  if (!name || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const [photo] = await db.insert(workloadPhotos).values({
    name, url, pathname: pathname ?? null, uploadedBy: session.id,
  }).returning();

  return NextResponse.json(photo);
}
