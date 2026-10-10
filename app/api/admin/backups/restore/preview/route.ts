import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { previewRestoreRequest } from "@/lib/restore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

function restoreErrorResponse(message: string) {
  if (
    message === "RESTORE_BACKUP_INVALID" ||
    message === "RESTORE_CATEGORY_INVALID" ||
    message === "RESTORE_REQUEST_INVALID" ||
    message === "RESTORE_MODE_REQUIRED" ||
    message === "RESTORE_PAGE_REQUIRED" ||
    message === "RESTORE_PRODUCT_REQUIRED" ||
    message === "RESTORE_CATEGORY_IDS_REQUIRED"
  ) {
    return NextResponse.json(
      { error: "طلب الاستعادة غير صالح." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  if (message === "RESTORE_CATEGORIES_REQUIRED") {
    return NextResponse.json(
      { error: "اختر قسماً واحداً على الأقل للاستعادة." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  if (
    message === "RESTORE_BACKUP_NOT_FOUND" ||
    message === "RESTORE_BACKUP_NOT_RESTORABLE" ||
    message === "RESTORE_BACKUP_INCOMPLETE" ||
    message === "RESTORE_BACKUP_INCOMPATIBLE" ||
    message === "RESTORE_PAGE_NOT_FOUND" ||
    message === "RESTORE_PRODUCT_NOT_FOUND" ||
    message === "RESTORE_CATEGORY_NOT_FOUND" ||
    message === "RESTORE_ROLLBACK_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "لا يمكن استعادة هذه النسخة." },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }
  return null;
}

/** Read-only restore preview. Never writes live data or backup files. */
export async function POST(request: Request) {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  try {
    const body = await request.json();
    const preview = await previewRestoreRequest(body);
    return NextResponse.json(preview, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const mapped = restoreErrorResponse(message);
    if (mapped) return mapped;
    console.error("Restore preview failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز معاينة الاستعادة." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
