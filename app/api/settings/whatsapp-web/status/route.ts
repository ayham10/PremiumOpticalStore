import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { fetchOracleAdminStatus } from "@/lib/whatsapp/oracle-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession("settings");
    const status = await fetchOracleAdminStatus();
    return NextResponse.json(
      {
        ok: status.ok,
        configured: status.configured,
        reachable: status.reachable,
        status: status.status,
        ready: status.ready,
        hasQr: status.hasQr,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Live reachability check against Oracle GET /status. Never sends a WhatsApp message. */
export async function POST() {
  try {
    await requireSession("settings");
    const status = await fetchOracleAdminStatus();
    if (!status.configured) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          reachable: false,
          ready: false,
          status: "UNCONFIGURED",
          error: "WhatsApp Web service is not configured on the server.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!status.reachable) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          reachable: false,
          ready: false,
          status: "UNAVAILABLE",
          error: "WhatsApp Web service unavailable",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        configured: true,
        reachable: true,
        ready: status.ready,
        status: status.status,
        hasQr: status.hasQr,
        message: status.ready
          ? "WhatsApp Web service connected (READY)."
          : `WhatsApp Web service reachable (${status.status}).`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
