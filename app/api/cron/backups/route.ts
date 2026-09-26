import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runDailyBackup } from "@/lib/backup";
import { serverEnv } from "@/lib/twilio/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(request: Request): boolean {
  const cronSecret = serverEnv("CRON_SECRET");
  const authHeader = request.headers.get("authorization") ?? "";
  if (!cronSecret) return false;
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyBackup();
    if (!result.complete) {
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Daily backup failed", error);
    return NextResponse.json(
      {
        ok: false,
        complete: false,
        error: error instanceof Error ? error.message : "Backup failed",
      },
      { status: 500 },
    );
  }
}
