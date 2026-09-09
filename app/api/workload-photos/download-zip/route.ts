import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import JSZip from "jszip";
import { getSessionFromRequest } from "../../../../lib/auth/session";
import { db } from "../../../../lib/db/client";
import { workloadPhotos } from "../../../../lib/db/schema";
import { inArray } from "drizzle-orm";

// Bridges JSZip's Node-stream-style internal stream to a Web ReadableStream,
// so the whole archive is never buffered into memory before responding --
// necessary for real, uncompressed multi-MB photos, which a fully-buffered
// response can silently truncate/exceed platform response-size limits on.
function zipToWebStream(zip: JSZip): ReadableStream<Uint8Array> {
  const internal = zip.generateInternalStream({ type: "uint8array", streamFiles: true });
  return new ReadableStream<Uint8Array>({
    start(controller) {
      internal.on("data", (chunk: Uint8Array) => controller.enqueue(chunk));
      internal.on("error", (err: Error) => controller.error(err));
      internal.on("end", () => controller.close());
      internal.resume();
    },
    cancel() {
      internal.pause();
    },
  });
}

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

    let name = photo.name;
    if (usedNames.has(name)) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      name = `${base} (${photo.id.slice(0, 8)})${ext}`;
    }
    usedNames.add(name);

    // Pass a promise, not the bytes -- JSZip fetches each file lazily as the
    // stream reaches it, instead of every photo being pulled into memory at
    // once up front. Raw bytes throughout, no re-encoding: original quality
    // preserved.
    const pathname = photo.pathname;
    zip.file(name, (async () => {
      const result = await get(pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN || undefined });
      if (result?.statusCode !== 200 || !result.stream) return new Uint8Array();
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    })());
  }

  return new NextResponse(zipToWebStream(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="workload-photos.zip"`,
    },
  });
}
