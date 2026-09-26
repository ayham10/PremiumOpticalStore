import { NextResponse } from "next/server";
import { runDailyBackup } from "@/lib/backup";
import { serverEnv } from "@/lib/twilio/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = serverEnv("CRON_SECRET");
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyBackup();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Daily backup failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Backup failed",
      },
      { status: 500 },
    );
  }
}
