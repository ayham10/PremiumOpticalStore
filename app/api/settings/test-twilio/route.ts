import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireSession("settings");

    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();

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
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
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

    return NextResponse.json({
      ok: true,
      message: "Twilio connection successful.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
