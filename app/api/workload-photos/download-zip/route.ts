import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import JSZip from "jszip";
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

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const photo of photos) {
    if (!photo.pathname) continue; // legacy/external-url rows have nothing we can fetch server-side
    const result = await get(photo.pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN || undefined });
    if (result?.statusCode !== 200 || !result.stream) continue;
    const bytes = await new Response(result.stream).arrayBuffer();

    let name = photo.name;
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      name = `${base} (${photo.id.slice(0, 8)})${ext}`;
    }
    usedNames.add(name);
    zip.file(name, bytes); // raw bytes, no re-encoding -- original quality preserved
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="workload-photos.zip"`,
    },
  });
}
