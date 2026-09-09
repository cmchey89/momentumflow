import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSessionFromRequest } from "../../../../lib/auth/session";

// Streams a private blob to the browser after checking the session -- never
// exposes the underlying private.blob.vercel-storage.com URL directly.
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pathname = req.nextUrl.searchParams.get("pathname");
  const name = req.nextUrl.searchParams.get("name") ?? "download";
  if (!pathname) return NextResponse.json({ error: "Missing pathname" }, { status: 400 });

  // Explicit token pins the same static-credential path that already works,
  // instead of the SDK's default OIDC-first resolution -- which fails here
  // with "OIDC is enabled for this project, but not for the development
  // environment." No-op if the var is unset (falls through exactly as before).
  const result = await get(pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN || undefined });
  if (result?.statusCode !== 200) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
