import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { approvedTwilioTemplatesPublicStatus } from "@/lib/twilio/content-sids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * Admin-only approved-template configuration flags.
 * Returns safe booleans only — never Content SIDs, env values, or secrets.
 */
export async function GET() {
  try {
    await requireSession("settings");
    return NextResponse.json(
      { templates: approvedTwilioTemplatesPublicStatus() },
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
