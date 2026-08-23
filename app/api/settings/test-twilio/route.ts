import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { getTwilioConfig, serverEnv, twilioBasicAuth } from "@/lib/twilio/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSession("settings");

    const sid = serverEnv("TWILIO_ACCOUNT_SID");
    const token = serverEnv("TWILIO_AUTH_TOKEN");

    if (!sid || !token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Twilio credentials are not configured on the server.",
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`,
      {
        headers: {
          Authorization: `Basic ${twilioBasicAuth({
            accountSid: sid,
            authToken: token,
            whatsappFrom: "",
          })}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: detail
            ? "Twilio connection failed. Check server credentials."
            : `Twilio connection failed (${response.status}).`,
        },
        { status: 400 },
      );
    }

    const config = getTwilioConfig();

    return NextResponse.json({
      ok: true,
      message: "Twilio connection successful.",
      whatsappConfigured: Boolean(config?.whatsappFrom),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
