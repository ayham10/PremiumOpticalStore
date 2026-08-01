import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight probe for verifying the Next.js runtime is serving on Vercel. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "oyon-optical",
    timestamp: new Date().toISOString(),
  });
}
