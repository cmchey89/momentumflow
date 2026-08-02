import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionFromRequest } from "../../../../lib/auth/session";

// Generates short-lived client-upload tokens so the browser can upload files
// directly to private Vercel Blob storage, bypassing the ~4.5MB serverless
// function body limit. Auth happens here, before any token is handed out --
// without this check, anyone could upload to the store.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        access: "private",
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: session.id }),
      }),
      onUploadCompleted: async () => {
        // No-op: the client persists file metadata to Postgres itself right
        // after upload() resolves, since this webhook can't reach localhost
        // in local dev without a tunnel.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
