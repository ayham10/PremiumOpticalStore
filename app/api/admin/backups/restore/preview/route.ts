import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { previewRestore } from "@/lib/restore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

/** Read-only restore preview. Never writes live data or backup files. */
export async function POST(request: Request) {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  try {
    const body = (await request.json()) as {
      backupId?: unknown;
      categories?: unknown;
    };
    const preview = await previewRestore(body.backupId, body.categories);
    return NextResponse.json(preview, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "RESTORE_BACKUP_INVALID" || message === "RESTORE_CATEGORY_INVALID") {
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
    if (message === "RESTORE_CATEGORIES_REQUIRED") {
      return NextResponse.json(
        { error: "اختر قسماً واحداً على الأقل للاستعادة." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    console.error("Restore preview failed", error);
    return NextResponse.json(
      { error: "تعذر تجهيز معاينة الاستعادة." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
