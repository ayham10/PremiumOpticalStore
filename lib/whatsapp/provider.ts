import { normalizeIsraeliPhone } from "@/lib/eye-exam";

export type WhatsAppSendResult = {
  ok: boolean;
  provider: "meta";
  status: "sent" | "failed" | "skipped";
  error?: string;
  externalId?: string;
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters?: string[];
};

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0";

/** Meta expects international digits only, e.g. 972501234567 (no +). */
export function formatPhoneForWhatsAppMeta(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (/^9725\d{8}$/.test(digitsOnly)) return digitsOnly;

  const normalized = normalizeIsraeliPhone(trimmed);
  if (!normalized) return null;

  const metaDigits = normalized.replace(/^\+/, "");
  return /^9725\d{8}$/.test(metaDigits) ? metaDigits : null;
}

export function sanitizeWhatsAppError(detail: string): string {
  return detail
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/access_token[=:]\S+/gi, "access_token=[redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .slice(0, 500);
}

function getWhatsAppConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "hello_world",
    templateLanguage:
      process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US",
  };
}

export function isWhatsAppConfigured(): boolean {
  const { accessToken, phoneNumberId } = getWhatsAppConfig();
  return Boolean(accessToken && phoneNumberId);
}

export async function sendWhatsAppTemplate(
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();
  const to = formatPhoneForWhatsAppMeta(message.to);

  if (!to) {
    return {
      ok: false,
      provider: "meta",
      status: "failed",
      error: "Invalid recipient phone number for WhatsApp",
    };
  }

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      ok: false,
      provider: "meta",
      status: "skipped",
      error: "WhatsApp credentials are not configured",
    };
  }

  const template: Record<string, unknown> = {
    name: message.templateName || config.templateName,
    language: { code: message.languageCode || config.templateLanguage },
  };

  if (message.bodyParameters?.length) {
    template.components = [
      {
        type: "body",
        parameters: message.bodyParameters.map((text) => ({
          type: "text",
          text,
        })),
      },
    ];
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template,
      }),
    });

    const raw = await response.text().catch(() => "");
    let json: { messages?: Array<{ id?: string }>; error?: { message?: string } } =
      {};
    if (raw) {
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        json = {};
      }
    }

    if (!response.ok) {
      const detail =
        json.error?.message ||
        sanitizeWhatsAppError(raw) ||
        `Meta WhatsApp API error ${response.status}`;
      return {
        ok: false,
        provider: "meta",
        status: "failed",
        error: detail,
      };
    }

    return {
      ok: true,
      provider: "meta",
      status: "sent",
      externalId: json.messages?.[0]?.id,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "meta",
      status: "failed",
      error:
        error instanceof Error
          ? sanitizeWhatsAppError(error.message)
          : "WhatsApp send failed",
    };
  }
}

export async function sendWhatsAppBookingConfirmation(opts: {
  to: string;
  appointmentId: string;
}): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();

  return sendWhatsAppTemplate({
    to: opts.to,
    templateName: config.templateName,
    languageCode: config.templateLanguage,
  });
}

export function logWhatsAppBookingResult(
  result: WhatsAppSendResult,
  opts: { appointmentId: string; to: string },
): void {
  const recipient = formatPhoneForWhatsAppMeta(opts.to) || "[invalid]";
  if (result.ok) {
    console.info("[WhatsApp] booking confirmation sent", {
      appointmentId: opts.appointmentId,
      to: recipient,
      messageId: result.externalId,
      template: process.env.WHATSAPP_TEMPLATE_NAME || "hello_world",
    });
    return;
  }

  console.error("[WhatsApp] booking confirmation failed", {
    appointmentId: opts.appointmentId,
    to: recipient,
    status: result.status,
    error: result.error ? sanitizeWhatsAppError(result.error) : "Unknown error",
    template: process.env.WHATSAPP_TEMPLATE_NAME || "hello_world",
  });
}
