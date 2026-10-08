import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import { normalizeIsraeliPhone } from "@/lib/eye-exam";
import {
  checkTwilioWhatsAppVerification,
  consumeTwilioVerifyOtpCheckQuota,
  consumeTwilioVerifyOtpSendQuota,
  getTwilioVerifyOtpStatus,
  isTwilioVerifyOtpTestAllowed,
  requestClientIp,
  sendTwilioWhatsAppVerification,
} from "@/lib/twilio/verify-otp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function blocked() {
  return jsonError("Not found", 404);
}

/**
 * Development-only Twilio Verify WhatsApp OTP probe.
 * Blocked on Vercel Production. Does not send booking templates or write store data.
 */
export async function GET() {
  try {
    const status = getTwilioVerifyOtpStatus();
    if (status.runtime === "production" || !status.enabled) return blocked();
    await requireSession("settings");
    return NextResponse.json(status);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isTwilioVerifyOtpTestAllowed()) return blocked();
    await requireSession("settings");

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      phone?: string;
      code?: string;
    };
    const action = body.action === "verify" ? "verify" : body.action === "send" ? "send" : "";
    if (!action) {
      return jsonError("Action must be send or verify.", 400);
    }

    const phone = (body.phone || "").trim();
    const ip = requestClientIp(request);
    const quotaKey = normalizeIsraeliPhone(phone) || phone || "blank";

    if (action === "send") {
      if (!consumeTwilioVerifyOtpSendQuota(quotaKey, ip)) {
        return jsonError(
          "Too many send attempts. Wait a few minutes before trying again.",
          429,
        );
      }
      const result = await sendTwilioWhatsAppVerification(phone);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (!consumeTwilioVerifyOtpCheckQuota(quotaKey)) {
      return jsonError(
        "Too many verification attempts. Wait a few minutes before trying again.",
        429,
      );
    }
    const result = await checkTwilioWhatsAppVerification(phone, body.code || "");
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return handleRouteError(error);
  }
}
