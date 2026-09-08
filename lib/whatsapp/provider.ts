import { normalizeIsraeliPhone } from "@/lib/eye-exam";
import { serverEnv } from "@/lib/twilio/config";

export type WhatsAppProviderName = "meta" | "whatsapp-web";

export type WhatsAppSendResult = {
  ok: boolean;
  provider: WhatsAppProviderName;
  status: "sent" | "failed" | "skipped" | "queued";
  error?: string;
  externalId?: string;
  templateName?: string;
  scheduledFor?: string;
};

export type WhatsAppWebTextMessage = {
  to: string;
  message: string;
  templateName?: string;
};

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  contentVariables?: Record<string, string>;
  languageCode?: string;
  sendAt?: Date;
};

const GRAPH_API_VERSION = serverEnv("WHATSAPP_GRAPH_API_VERSION") || "v26.0";

export type MetaWhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  templateLanguage: string;
};

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
    .replace(/x-api-key[=:\s]+\S+/gi, "x-api-key=[redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .replace(/access_token[=:]\S+/gi, "access_token=[redacted]")
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .slice(0, 500);
}

export type WhatsAppWebServiceConfig = {
  baseUrl: string;
  apiKey: string;
};

export function getWhatsAppWebServiceConfig(): WhatsAppWebServiceConfig | null {
  const baseUrl = serverEnv("WHATSAPP_WEB_SERVICE_URL").replace(/\/+$/, "");
  const apiKey = serverEnv("WHATSAPP_WEB_SERVICE_API_KEY");
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

export function isWhatsAppWebServiceConfigured(): boolean {
  return getWhatsAppWebServiceConfig() !== null;
}

export function getMetaWhatsAppConfig(): MetaWhatsAppConfig {
  return {
    accessToken: serverEnv("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: serverEnv("WHATSAPP_PHONE_NUMBER_ID"),
    wabaId: serverEnv("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    templateLanguage: serverEnv("WHATSAPP_TEMPLATE_LANGUAGE") || "en_US",
  };
}

export function isWhatsAppConfigured(): boolean {
  const { accessToken, phoneNumberId } = getMetaWhatsAppConfig();
  return Boolean(accessToken && phoneNumberId);
}

/**
 * Israeli mobile digits for Oracle POST /send.
 * Compatible with whatsapp-web-service/src/phone.js (9725XXXXXXXX).
 */
export function formatPhoneForWhatsAppWeb(input: string): string | null {
  return formatPhoneForWhatsAppMeta(input);
}

export async function sendWhatsAppWebText(
  message: WhatsAppWebTextMessage,
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppWebServiceConfig();
  const to = formatPhoneForWhatsAppWeb(message.to);
  const text = message.message.trim();
  const templateName = message.templateName?.trim();

  if (!to) {
    return {
      ok: false,
      provider: "whatsapp-web",
      status: "failed",
      error: "Invalid recipient phone number for WhatsApp",
      templateName,
    };
  }

  if (!text) {
    return {
      ok: false,
      provider: "whatsapp-web",
      status: "failed",
      error: "Message text is required",
      templateName,
    };
  }

  if (!config) {
    return {
      ok: false,
      provider: "whatsapp-web",
      status: "skipped",
      error: "WhatsApp Web service is not configured",
      templateName,
    };
  }

  try {
    const response = await fetch(`${config.baseUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      body: JSON.stringify({ to, message: text }),
      cache: "no-store",
    });

    const raw = await response.text().catch(() => "");
    let json: {
      ok?: boolean;
      error?: string;
      messageId?: string;
      chatId?: string;
    } = {};
    if (raw) {
      try {
        json = JSON.parse(raw) as typeof json;
      } catch {
        json = {};
      }
    }

    if (!response.ok || json.ok === false) {
      const detail =
        json.error ||
        sanitizeWhatsAppError(raw) ||
        `WhatsApp Web service error ${response.status}`;
      return {
        ok: false,
        provider: "whatsapp-web",
        status: "failed",
        error: detail,
        templateName,
      };
    }

    const externalId =
      (typeof json.messageId === "string" && json.messageId) ||
      (typeof json.chatId === "string" && json.chatId) ||
      undefined;

    return {
      ok: true,
      provider: "whatsapp-web",
      status: "sent",
      externalId,
      templateName,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "whatsapp-web",
      status: "failed",
      error:
        error instanceof Error
          ? sanitizeWhatsAppError(error.message)
          : "WhatsApp Web send failed",
      templateName,
    };
  }
}

export function metaGraphUrl(path: string): string {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${normalized}`;
}

function contentVariablesToBodyParameters(
  variables?: Record<string, string>,
): string[] | undefined {
  if (!variables || !Object.keys(variables).length) return undefined;

  const numericKeys = Object.keys(variables)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b));

  if (numericKeys.length) {
    const values = numericKeys
      .map((key) => variables[key]?.trim() ?? "")
      .filter(Boolean);
    return values.length ? values : undefined;
  }

  const values = Object.values(variables)
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

export async function sendWhatsAppTemplate(
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppSendResult> {
  const config = getMetaWhatsAppConfig();
  const to = formatPhoneForWhatsAppMeta(message.to);
  const templateName = message.templateName.trim();

  if (!to) {
    return {
      ok: false,
      provider: "meta",
      status: "failed",
      error: "Invalid recipient phone number for WhatsApp",
      templateName,
    };
  }

  if (!config.accessToken || !config.phoneNumberId) {
    return {
      ok: false,
      provider: "meta",
      status: "skipped",
      error: "Meta WhatsApp credentials are not configured",
      templateName,
    };
  }

  if (message.sendAt && message.sendAt.getTime() > Date.now() + 60_000) {
    return {
      ok: true,
      provider: "meta",
      status: "queued",
      templateName,
      scheduledFor: message.sendAt.toISOString(),
    };
  }

  const template: Record<string, unknown> = {
    name: templateName,
    language: {
      code: message.languageCode || config.templateLanguage,
    },
  };

  const bodyParameters = contentVariablesToBodyParameters(message.contentVariables);
  if (bodyParameters?.length) {
    template.components = [
      {
        type: "body",
        parameters: bodyParameters.map((text) => ({
          type: "text",
          text,
        })),
      },
    ];
  }

  const url = metaGraphUrl(`${config.phoneNumberId}/messages`);

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
      cache: "no-store",
    });

    const raw = await response.text().catch(() => "");
    let json: {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    } = {};
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
        templateName,
        scheduledFor: message.sendAt?.toISOString(),
      };
    }

    return {
      ok: true,
      provider: "meta",
      status: "sent",
      externalId: json.messages?.[0]?.id,
      templateName,
      scheduledFor: message.sendAt?.toISOString(),
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
      templateName,
      scheduledFor: message.sendAt?.toISOString(),
    };
  }
}

export type WhatsAppBookingSendInput = WhatsAppTemplateMessage & {
  textMessage: string;
};

/**
 * Prefer Oracle WhatsApp Web (plain text /send) when configured.
 * Otherwise keep Meta Cloud API templates as the fallback.
 */
export async function sendBookingWhatsAppMessage(
  message: WhatsAppBookingSendInput,
): Promise<WhatsAppSendResult> {
  if (isWhatsAppWebServiceConfigured()) {
    if (message.sendAt && message.sendAt.getTime() > Date.now() + 60_000) {
      return {
        ok: true,
        provider: "whatsapp-web",
        status: "queued",
        templateName: message.templateName.trim(),
        scheduledFor: message.sendAt.toISOString(),
      };
    }

    return sendWhatsAppWebText({
      to: message.to,
      message: message.textMessage,
      templateName: message.templateName,
    });
  }

  return sendWhatsAppTemplate(message);
}

export function logWhatsAppBookingResult(
  result: WhatsAppSendResult,
  opts: {
    appointmentId: string;
    to: string;
    kind: "customer_confirmation" | "owner_notification" | "appointment_reminder";
  },
): void {
  const recipient = formatPhoneForWhatsAppMeta(opts.to) || "[invalid]";
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
