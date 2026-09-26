import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { executeRestore, isLiveRestoreAllowed } from "@/lib/restore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

/** Selective restore. Writes live store only after a complete pre-restore snapshot. */
export async function POST(request: Request) {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  if (!isLiveRestoreAllowed()) {
    return NextResponse.json(
      { error: "الاستعادة الفعلية متاحة فقط في بيئة الإنتاج" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const body = (await request.json()) as {
      backupId?: unknown;
      categories?: unknown;
      confirm?: unknown;
    };
    const result = await executeRestore(
      body.backupId,
      body.categories,
      body.confirm,
    );
    return NextResponse.json(result, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "RESTORE_PRODUCTION_ONLY") {
      return NextResponse.json(
        { error: "الاستعادة الفعلية متاحة فقط في بيئة الإنتاج" },
        { status: 403, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "RESTORE_CONFIRM_REQUIRED") {
      return NextResponse.json(
        { error: "يجب تأكيد الاستعادة أولاً." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "RESTORE_IN_PROGRESS") {
      return NextResponse.json(
        { error: "جاري تنفيذ استعادة أخرى. انتظر ثم أعد المحاولة." },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    if (
      message === "RESTORE_BACKUP_INVALID" ||
      message === "RESTORE_CATEGORY_INVALID" ||
      message === "RESTORE_CATEGORIES_REQUIRED"
    ) {
      return NextResponse.json(
        { error: "طلب الاستعادة غير صالح." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    if (
      message === "RESTORE_BACKUP_NOT_FOUND" ||
      message === "RESTORE_BACKUP_NOT_RESTORABLE" ||
      message === "RESTORE_BACKUP_INCOMPLETE"
    ) {
      return NextResponse.json(
        { error: "لا يمكن استعادة هذه النسخة." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "RESTORE_PRE_SNAPSHOT_FAILED") {
      return NextResponse.json(
        { error: "تعذر إنشاء نسخة الأمان قبل الاستعادة. لم يتم تغيير البيانات." },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    console.error("Restore execute failed", error);
    return NextResponse.json(
      { error: "تعذر استعادة البيانات." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
