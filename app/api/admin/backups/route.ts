import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import {
  getBackupStatusSummary,
  runManualBackup,
  toManualBackupClientResult,
} from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

const MANUAL_SUCCESS_COOLDOWN_MS = 12_000;
let lastManualSuccessAt = 0;

/** Admin-only read of backup metadata. Never writes. */
export async function GET() {
  try {
    await requireSession("settings");
    const summary = await getBackupStatusSummary();
    return NextResponse.json(summary, {
      status: 200,
      headers: PRIVATE_HEADERS,
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
        headers: PRIVATE_HEADERS,
      },
    );
  }
}

/** Admin-only manual restore point. Writes only to oyon-backups. */
export async function POST() {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  if (
    lastManualSuccessAt > 0 &&
    Date.now() - lastManualSuccessAt < MANUAL_SUCCESS_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "تم بدء نسخة احتياطية للتو. انتظر قليلاً ثم أعد المحاولة." },
      { status: 429, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const result = await runManualBackup();
    const body = toManualBackupClientResult(result);
    if (!result.complete) {
      return NextResponse.json(
        {
          ...body,
          error:
            "لم تكتمل النسخة الاحتياطية. تم حفظ تقدّم الوسائط، ويمكن إعادة المحاولة.",
        },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    lastManualSuccessAt = Date.now();
    return NextResponse.json(body, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof Error && error.message === "MANUAL_BACKUP_IN_PROGRESS") {
      return NextResponse.json(
        { error: "جاري إنشاء نسخة احتياطية بالفعل. انتظر ثم أعد المحاولة." },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    console.error("Manual backup failed", error);
    return NextResponse.json(
      { error: "تعذر إنشاء النسخة الاحتياطية." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
