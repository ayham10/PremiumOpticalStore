import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { getBackupStatusSummary } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** Admin-only read of backup metadata. GET only. Never writes. */
export async function GET() {
  try {
    await requireSession("settings");
    const summary = await getBackupStatusSummary();
    return NextResponse.json(summary, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return handleRouteError(error);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return handleRouteError(error);
    }
    console.error("Backup status read failed", error);
    return NextResponse.json(
      { error: "تعذر قراءة حالة النسخ الاحتياطي" },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
