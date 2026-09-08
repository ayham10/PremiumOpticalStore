import {
  getWhatsAppWebServiceConfig,
  sanitizeWhatsAppError,
} from "@/lib/whatsapp/provider";

export type OracleConnectionStatus =
  | "INITIALIZING"
  | "QR_REQUIRED"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED"
  | "AUTH_FAILURE";

export type OracleAdminStatus = {
  ok: boolean;
  configured: boolean;
  reachable: boolean;
  status: OracleConnectionStatus | "UNAVAILABLE" | "UNCONFIGURED";
  ready: boolean;
  hasQr: boolean;
  lastError: string | null;
};

export type OracleAdminQr = {
  ok: boolean;
  configured: boolean;
  reachable: boolean;
  status: OracleConnectionStatus | "UNAVAILABLE" | "UNCONFIGURED";
  ready: boolean;
  qrDataUrl: string | null;
  generatedAt: string | null;
};

const FETCH_TIMEOUT_MS = 8000;

function isConnectionStatus(value: unknown): value is OracleConnectionStatus {
  return (
    value === "INITIALIZING" ||
    value === "QR_REQUIRED" ||
    value === "AUTHENTICATED" ||
    value === "READY" ||
    value === "DISCONNECTED" ||
    value === "AUTH_FAILURE"
  );
}

async function fetchOracleJson(path: string): Promise<{
  ok: boolean;
  statusCode: number;
  json: Record<string, unknown> | null;
  error: string | null;
}> {
  const config = getWhatsAppWebServiceConfig();
  if (!config) {
    return {
      ok: false,
      statusCode: 503,
      json: null,
      error: "WhatsApp Web service is not configured",
    };
  }

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": config.apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const raw = await response.text().catch(() => "");
    let json: Record<string, unknown> | null = null;
    if (raw) {
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        json = null;
      }
    }
    if (!response.ok) {
      const detail =
        (typeof json?.error === "string" && json.error) ||
        sanitizeWhatsAppError(raw) ||
        `WhatsApp Web service error ${response.status}`;
      return {
        ok: false,
        statusCode: response.status,
        json,
        error: sanitizeWhatsAppError(detail),
      };
    }
    return { ok: true, statusCode: response.status, json, error: null };
  } catch (error) {
    return {
      ok: false,
      statusCode: 503,
      json: null,
      error:
        error instanceof Error
          ? sanitizeWhatsAppError(error.message)
          : "WhatsApp Web service unavailable",
    };
  }
}

export async function fetchOracleAdminStatus(): Promise<OracleAdminStatus> {
  if (!getWhatsAppWebServiceConfig()) {
    return {
      ok: false,
      configured: false,
      reachable: false,
      status: "UNCONFIGURED",
      ready: false,
      hasQr: false,
      lastError: "WhatsApp Web service is not configured",
    };
  }

  const result = await fetchOracleJson("/status");
  if (!result.ok || !result.json) {
    return {
      ok: false,
      configured: true,
      reachable: false,
      status: "UNAVAILABLE",
      ready: false,
      hasQr: false,
      lastError: result.error,
    };
  }

  const status = isConnectionStatus(result.json.status)
    ? result.json.status
    : "UNAVAILABLE";
  return {
    ok: true,
    configured: true,
    reachable: true,
    status,
    ready: result.json.ready === true || status === "READY",
    hasQr: result.json.hasQr === true,
    lastError: null,
  };
}

export async function fetchOracleAdminQr(): Promise<OracleAdminQr> {
  if (!getWhatsAppWebServiceConfig()) {
    return {
      ok: false,
      configured: false,
      reachable: false,
      status: "UNCONFIGURED",
      ready: false,
      qrDataUrl: null,
      generatedAt: null,
    };
  }

  const result = await fetchOracleJson("/qr");
  if (!result.ok || !result.json) {
    return {
      ok: false,
      configured: true,
      reachable: false,
      status: "UNAVAILABLE",
      ready: false,
      qrDataUrl: null,
      generatedAt: null,
    };
  }

  const status = isConnectionStatus(result.json.status)
    ? result.json.status
    : "UNAVAILABLE";
  const ready = status === "READY";
  const qrDataUrl =
    !ready &&
    typeof result.json.qrDataUrl === "string" &&
    result.json.qrDataUrl.startsWith("data:image/")
      ? result.json.qrDataUrl
      : null;

  return {
    ok: true,
    configured: true,
    reachable: true,
    status,
    ready,
    qrDataUrl,
    generatedAt:
      typeof result.json.generatedAt === "string"
        ? result.json.generatedAt
        : null,
  };
}
