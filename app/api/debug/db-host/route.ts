import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL || "";
  const match = url.match(/@([^/]+)\//);
  return NextResponse.json({ host: match ? match[1] : "unset" });
}
