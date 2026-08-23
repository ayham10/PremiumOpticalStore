import { normalizeIsraeliPhone } from "@/lib/eye-exam";
import { resolveTwilioContentSid } from "@/lib/twilio/content-sids";
import {
  getTwilioConfig,
  isTwilioWhatsAppConfigured,
  normalizeWhatsAppAddress,
  twilioBasicAuth,
  type TwilioConfig,
} from "@/lib/twilio/config";

export type WhatsAppSendResult = {
  ok: boolean;
  provider: "twilio";
  status: "sent" | "failed" | "skipped" | "queued";
  error?: string;
  externalId?: string;
  templateName?: string;
  scheduledFor?: string;
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  contentVariables?: Record<string, string>;
  sendAt?: Date;
};

const TWILIO_MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000;
const TWILIO_MAX_SCHEDULE_DAYS = 35;

/** Normalize Israeli numbers to `whatsapp:+972...` for Twilio. */
export function formatPhoneForWhatsAppTwilio(input: string): string | null {
  const normalized = normalizeIsraeliPhone(input);
  if (!normalized) return null;
  return normalizeWhatsAppAddress(normalized);
}

export function sanitizeWhatsAppError(detail: string): string {
  return detail
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/AC[a-z0-9]{32}/gi, "AC[redacted]")
    .replace(/SK[a-z0-9]{32}/gi, "SK[redacted]")
    .replace(/auth[_-]?token[=:]\S+/gi, "auth_token=[redacted]")
    .slice(0, 500);
}

function parseTwilioError(raw: string): string {
  if (!raw) return "";
  try {
    const json = JSON.parse(raw) as { message?: string; more_info?: string };
    return json.message || json.more_info || raw;
  } catch {
    return raw;
  }
}

function canScheduleAt(sendAt: Date, now = new Date()): boolean {
  const min = now.getTime() + TWILIO_MIN_SCHEDULE_LEAD_MS;
  const max =
    now.getTime() + TWILIO_MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
  const ts = sendAt.getTime();
  return ts >= min && ts <= max;
}

export { isTwilioWhatsAppConfigured as isWhatsAppConfigured };

export async function sendWhatsAppTemplate(
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppSendResult> {
  const config = getTwilioConfig();
  const to = formatPhoneForWhatsAppTwilio(message.to);
  const templateName = message.templateName.trim();

  if (!to) {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      error: "Invalid recipient phone number for WhatsApp",
      templateName,
    };
  }

  if (!config) {
    return {
      ok: false,
      provider: "twilio",
      status: "skipped",
      error: "Twilio WhatsApp credentials are not configured",
      templateName,
    };
  }

  const contentSid = resolveTwilioContentSid(templateName);
  if (!contentSid) {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      error: `No Twilio Content SID mapped for template "${templateName}"`,
      templateName,
    };
  }

  const params = new URLSearchParams({
    From: config.whatsappFrom,
    To: to,
    ContentSid: contentSid,
  });

  if (message.contentVariables && Object.keys(message.contentVariables).length) {
    params.set("ContentVariables", JSON.stringify(message.contentVariables));
  }

  let scheduledFor: string | undefined;
  if (message.sendAt) {
    if (!canScheduleAt(message.sendAt)) {
      return {
        ok: false,
        provider: "twilio",
        status: "skipped",
        error: "Reminder send time is outside Twilio scheduling window",
        templateName,
        scheduledFor: message.sendAt.toISOString(),
      };
    }
    scheduledFor = message.sendAt.toISOString();
    params.set("ScheduleType", "fixed");
    params.set("SendAt", scheduledFor);
  }

  return postTwilioWhatsAppMessage(config, params, {
    templateName,
    scheduledFor,
  });
}

async function postTwilioWhatsAppMessage(
  config: TwilioConfig,
  params: URLSearchParams,
  meta: { templateName: string; scheduledFor?: string },
): Promise<WhatsAppSendResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    config.accountSid,
  )}/Messages.json`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioBasicAuth(config)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      cache: "no-store",
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      const detail = sanitizeWhatsAppError(
        parseTwilioError(raw) || `Twilio WhatsApp API error ${response.status}`,
      );
      return {
        ok: false,
        provider: "twilio",
        status: "failed",
        error: detail,
        templateName: meta.templateName,
        scheduledFor: meta.scheduledFor,
      };
    }

    let json: { sid?: string; status?: string } = {};
    if (raw) {
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        json = {};
      }
    }

    const queued =
      meta.scheduledFor != null || json.status === "scheduled" || json.status === "queued";

    return {
      ok: true,
      provider: "twilio",
      status: queued ? "queued" : "sent",
      externalId: json.sid,
      templateName: meta.templateName,
      scheduledFor: meta.scheduledFor,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      error:
        error instanceof Error
          ? sanitizeWhatsAppError(error.message)
          : "WhatsApp send failed",
      templateName: meta.templateName,
      scheduledFor: meta.scheduledFor,
    };
  }
}

export function logWhatsAppBookingResult(
  result: WhatsAppSendResult,
  opts: {
    appointmentId: string;
    to: string;
    kind: "customer_confirmation" | "owner_notification" | "appointment_reminder";
  },
): void {
  const recipient = formatPhoneForWhatsAppTwilio(opts.to) || "[invalid]";
  const base = {
    appointmentId: opts.appointmentId,
    to: recipient,
    kind: opts.kind,
    template: result.templateName,
    scheduledFor: result.scheduledFor,
  };

  if (result.ok) {
    console.info("[WhatsApp] booking message sent", {
      ...base,
      messageId: result.externalId,
      status: result.status,
    });
    return;
  }

  console.error("[WhatsApp] booking message failed", {
    ...base,
    status: result.status,
    error: result.error ? sanitizeWhatsAppError(result.error) : "Unknown error",
  });
}
