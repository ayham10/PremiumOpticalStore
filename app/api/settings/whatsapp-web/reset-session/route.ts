import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { resetOracleWhatsAppSession } from "@/lib/whatsapp/oracle-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    await requireSession("settings");
    const result = await resetOracleWhatsAppSession();
    if (!result.configured) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          reachable: false,
          status: "UNCONFIGURED",
          error: "WhatsApp Web service is not configured on the server.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!result.ok) {
      if (result.inProgress) {
        return NextResponse.json(
          {
            ok: true,
            configured: true,
            reachable: true,
            status: result.status,
            inProgress: true,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          reachable: result.reachable,
          status: result.status,
          error:
            result.status === "READY"
              ? "WhatsApp is already connected."
              : "Could not reset the WhatsApp session.",
        },
        {
          status: result.status === "READY" ? 409 : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        reachable: true,
        status: result.status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
