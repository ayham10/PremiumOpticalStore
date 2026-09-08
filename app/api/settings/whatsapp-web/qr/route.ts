import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { fetchOracleAdminQr } from "@/lib/whatsapp/oracle-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession("settings");
    const qr = await fetchOracleAdminQr();
    return NextResponse.json(
      {
        ok: qr.ok,
        configured: qr.configured,
        reachable: qr.reachable,
        status: qr.status,
        ready: qr.ready,
        qrDataUrl: qr.ready ? null : qr.qrDataUrl,
        generatedAt: qr.ready ? null : qr.generatedAt,
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
