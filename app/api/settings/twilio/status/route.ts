import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { checkTwilioApiHealth } from "@/lib/twilio/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** Admin-only Twilio API health check. Never sends a WhatsApp message. */
export async function GET() {
  try {
    await requireSession("settings");
    const status = await checkTwilioApiHealth();
    return NextResponse.json(
      {
        configured: status.configured,
        connected: status.connected,
        from: status.from,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
