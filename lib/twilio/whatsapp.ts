import { normalizeIsraeliPhone } from "@/lib/eye-exam";
import { resolveTwilioContentSid } from "@/lib/twilio/content-sids";
import {
  getTwilioConfig,
  normalizeWhatsAppAddress,
  twilioBasicAuth,
  type TwilioConfig,
} from "@/lib/twilio/config";

export type TwilioWhatsAppSendResult = {
  ok: boolean;
  provider: "twilio";
  status: "sent" | "failed" | "skipped" | "queued";
  error?: string;
  externalId?: string;
  templateName?: string;
};

/** Normalize Israeli numbers to `whatsapp:+972...` for Twilio. */
export function formatPhoneForWhatsAppTwilio(input: string): string | null {
  const normalized = normalizeIsraeliPhone(input);
  if (!normalized) return null;
  return normalizeWhatsAppAddress(normalized);
}

function sanitizeWhatsAppError(detail: string): string {
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

/**
 * Twilio Content-template send (Messages.json + ContentSid).
 * Used for live customer confirmation, owner notification, and reminders.
 * Oracle WhatsApp Web / Meta sendBookingWhatsAppMessage remains available.
 */
export async function sendTwilioWhatsAppTemplate(message: {
  to: string;
  templateName: string;
  contentVariables?: Record<string, string>;
}): Promise<TwilioWhatsAppSendResult> {
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

  return postTwilioWhatsAppMessage(config, params, templateName);
}

async function postTwilioWhatsAppMessage(
  config: TwilioConfig,
  params: URLSearchParams,
  templateName: string,
): Promise<TwilioWhatsAppSendResult> {
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
      return {
        ok: false,
        provider: "twilio",
        status: "failed",
        error: sanitizeWhatsAppError(
          parseTwilioError(raw) || `Twilio WhatsApp API error ${response.status}`,
        ),
        templateName,
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

    return {
      ok: true,
      provider: "twilio",
      status: json.status === "queued" ? "queued" : "sent",
      externalId: json.sid,
      templateName,
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
      templateName,
    };
  }
}
