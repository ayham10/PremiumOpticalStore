import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import { DEFAULT_BOOKING_MESSAGES } from "@/lib/booking-messages";
import { serverEnv } from "@/lib/twilio/config";
import { sendTwilioWhatsAppTemplate } from "@/lib/twilio/whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION_TEMPLATE =
  DEFAULT_BOOKING_MESSAGES.customerConfirmation.templateName;

function headerSecret(request: Request): string {
  const named = request.headers.get("x-oyon-test-secret")?.trim() || "";
  if (named) return named;
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

async function authorizeTestRequest(request: Request): Promise<boolean> {
  const expected =
    serverEnv("OYON_WHATSAPP_TEST_SECRET") || serverEnv("CRON_SECRET");
  const provided = headerSecret(request);
  if (expected && provided && provided === expected) {
    return true;
  }
  try {
    await requireSession("settings");
    return true;
  } catch {
    return false;
  }
}

/**
 * Temporary private probe: Vercel → Twilio Content API → booking confirmation
 * template. Does not touch live booking / owner / reminder dispatch.
 */
export async function POST(request: Request) {
  try {
    if (!(await authorizeTestRequest(request))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      to?: string;
      name?: string;
      date?: string;
      time?: string;
    };

    const to = (body.to || "").trim();
    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing test recipient `to`." },
        { status: 400 },
      );
    }

    const result = await sendTwilioWhatsAppTemplate({
      to,
      templateName: CONFIRMATION_TEMPLATE,
      contentVariables: {
        "1": (body.name || "Test Customer").trim(),
        "2": (body.date || "2026-09-20").trim(),
        "3": (body.time || "10:00").trim(),
      },
    });

    return NextResponse.json(
      {
        ok: result.ok,
        provider: result.provider,
        status: result.status,
        templateName: result.templateName,
        externalId: result.externalId,
        error: result.error,
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
