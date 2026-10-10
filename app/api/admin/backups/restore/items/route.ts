import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { loadRestorableSnapshot } from "@/lib/backup";
import { listSnapshotItems, parseSnapshotId, validateRestorableAppData } from "@/lib/restore-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

/** Client-safe item lists from a snapshot. Never returns appData, URLs, or tokens. */
export async function POST(request: Request) {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  try {
    const body = (await request.json()) as { backupId?: unknown };
    const parsed = parseSnapshotId(body.backupId);
    if (parsed.kind === "pre-restore") {
      return NextResponse.json(
        { error: "طلب الاستعادة غير صالح." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    const snapshot = await loadRestorableSnapshot(
      `${parsed.kind}:${parsed.createdAt}`,
    );
    if (!snapshot) {
      return NextResponse.json(
        { error: "لا يمكن استعادة هذه النسخة." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }
    const appData = validateRestorableAppData(snapshot.appData);
    return NextResponse.json(listSnapshotItems(appData), {
      status: 200,
      headers: PRIVATE_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "RESTORE_BACKUP_INVALID") {
      return NextResponse.json(
        { error: "طلب الاستعادة غير صالح." },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }
    if (
      message === "RESTORE_BACKUP_INCOMPLETE" ||
      message === "RESTORE_BACKUP_INCOMPATIBLE"
    ) {
      return NextResponse.json(
        { error: "لا يمكن استعادة هذه النسخة." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    }
    console.error("Restore items listing failed", error);
    return NextResponse.json(
      { error: "تعذر قراءة محتويات النسخة." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
