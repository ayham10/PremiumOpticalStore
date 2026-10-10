import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import {
  isGithubBackupAllowed,
  readGithubBackupStatus,
  runGithubBackupAll,
  toGithubBackupClientResult,
} from "@/lib/github-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
} as const;

/** Client-safe GitHub backup history. Never returns tokens, repo names, or customer records. */
export async function GET() {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  try {
    const summary = await readGithubBackupStatus();
    return NextResponse.json(summary, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error("GitHub backup status read failed");
    void error;
    return NextResponse.json(
      { error: "تعذر قراءة حالة نسخة GitHub." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

/** Disaster copy to the private GitHub backup repo. Never writes live store/media. */
export async function POST() {
  try {
    await requireSession("settings");
  } catch (error) {
    return handleRouteError(error);
  }

  if (!isGithubBackupAllowed()) {
    return NextResponse.json(
      { error: "النسخ إلى GitHub متاح فقط في بيئة الإنتاج" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const result = await runGithubBackupAll();
    const body = toGithubBackupClientResult(result);
    if (!result.complete) {
      return NextResponse.json(
        {
          ...body,
          error:
            "لم تكتمل النسخة على GitHub. تم حفظ التقدّم، ويمكن الضغط على نسخ الكل مرة أخرى.",
        },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    return NextResponse.json(body, { status: 200, headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "GITHUB_BACKUP_PRODUCTION_ONLY") {
      return NextResponse.json(
        { error: "النسخ إلى GitHub متاح فقط في بيئة الإنتاج" },
        { status: 403, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "GITHUB_BACKUP_IN_PROGRESS") {
      return NextResponse.json(
        { error: "جاري إنشاء نسخة GitHub بالفعل. انتظر ثم أعد المحاولة." },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "GITHUB_BACKUP_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "تعذر إنشاء النسخة على GitHub." },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "GITHUB_BACKUP_REPO_INACCESSIBLE") {
      return NextResponse.json(
        { error: "تعذر الوصول إلى مستودع النسخ على GitHub." },
        { status: 502, headers: PRIVATE_HEADERS },
      );
    }
    if (message === "GITHUB_BACKUP_API_FAILED") {
      return NextResponse.json(
        { error: "تعذر إنشاء النسخة على GitHub." },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }
    console.error("GitHub backup failed");
    return NextResponse.json(
      { error: "تعذر إنشاء النسخة على GitHub." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
