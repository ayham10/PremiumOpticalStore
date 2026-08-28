import { NextResponse } from "next/server";
import { processDueAppointmentReminders } from "@/lib/booking-messaging";
import { serverEnv } from "@/lib/twilio/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = serverEnv("CRON_SECRET");
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueAppointmentReminders();
  return NextResponse.json({ ok: true, ...result });
}
