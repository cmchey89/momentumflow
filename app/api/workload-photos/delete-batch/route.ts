import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { workloadPhotos } from "../../../../lib/db/schema";
import { inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const photos = await db.select().from(workloadPhotos).where(inArray(workloadPhotos.id, ids));

  await Promise.all(photos.map(async p => {
    if (p.pathname) {
      try { await del(p.url, { token: process.env.BLOB_READ_WRITE_TOKEN || undefined }); } catch { /* already gone from storage -- fine, still remove the row */ }
    }
  }));
  await db.delete(workloadPhotos).where(inArray(workloadPhotos.id, ids));

  return NextResponse.json({ ok: true, deleted: photos.length });
}
