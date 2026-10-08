import { normalizeIsraeliPhone } from "@/lib/eye-exam";
import { serverEnv, twilioBasicAuth } from "@/lib/twilio/config";

export const TWILIO_VERIFY_OTP_MISSING_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
] as const;

/** Resource SID (not a secret). Overridable via TWILIO_VERIFY_SERVICE_SID. */
const DEFAULT_VERIFY_SERVICE_SID = "VAae12300bae697eafe242c14a05f98d37";

const SEND_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const MAX_SEND_PER_PHONE = 3;
const MAX_SEND_PER_IP = 8;
const MAX_VERIFY_PER_PHONE = 8;

type RateBuckets = {
  sendPhone: Map<string, number[]>;
  sendIp: Map<string, number[]>;
  verifyPhone: Map<string, number[]>;
};

const buckets: RateBuckets = {
  sendPhone: new Map(),
  sendIp: new Map(),
  verifyPhone: new Map(),
};

export type TwilioVerifyRuntime = "production" | "preview" | "development" | "local";

export type TwilioVerifyOtpStatus = {
  enabled: boolean;
  configured: boolean;
  missing: string[];
  runtime: TwilioVerifyRuntime;
};

export type TwilioVerifyOtpResult = {
  ok: boolean;
  action: "send" | "verify";
  status: string;
  to?: string;
  channel?: string;
  valid?: boolean;
  error?: string;
};

function envRecordValue(env: NodeJS.ProcessEnv | undefined, name: string): string {
  const value = env?.[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Bracket access avoids Next.js build-time inlining of VERCEL_ENV. */
export function readTwilioVerifyRuntime(
  vercelEnv?: string,
  env: NodeJS.ProcessEnv = process.env,
): TwilioVerifyRuntime {
  const raw = (vercelEnv ?? envRecordValue(env, "VERCEL_ENV")).toLowerCase();
  if (raw === "production") return "production";
  if (raw === "preview") return "preview";
  if (raw === "development") return "development";
  return "local";
}

export function isTwilioVerifyOtpTestAllowed(
  vercelEnv?: string,
  _allowFlag?: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const runtime = readTwilioVerifyRuntime(vercelEnv, env);
  if (runtime === "production") return false;
  return runtime === "preview" || runtime === "development" || runtime === "local";
}

export function listMissingTwilioVerifyOtpVars(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = [];
  for (const name of TWILIO_VERIFY_OTP_MISSING_VARS) {
    const value = env[name];
    if (typeof value !== "string" || !value.trim()) missing.push(name);
  }
  return missing;
}

export function getTwilioVerifyServiceSid(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = typeof env.TWILIO_VERIFY_SERVICE_SID === "string"
    ? env.TWILIO_VERIFY_SERVICE_SID.trim()
    : "";
  return fromEnv || DEFAULT_VERIFY_SERVICE_SID;
}

export function getTwilioVerifyOtpStatus(
  vercelEnv?: string,
  allowFlag?: string,
  env: NodeJS.ProcessEnv = process.env,
): TwilioVerifyOtpStatus {
  const runtime = readTwilioVerifyRuntime(vercelEnv, env);
  const enabled = isTwilioVerifyOtpTestAllowed(vercelEnv, allowFlag, env);
  if (!enabled) {
    return { enabled: false, configured: false, missing: [], runtime };
  }
  const missing = listMissingTwilioVerifyOtpVars(env);
  return {
    enabled: true,
    configured: missing.length === 0,
    missing,
    runtime,
  };
}

export function resetTwilioVerifyOtpRateLimitsForTests() {
  buckets.sendPhone.clear();
  buckets.sendIp.clear();
  buckets.verifyPhone.clear();
}

function prune(times: number[], now: number, windowMs: number): number[] {
  return times.filter((time) => now - time < windowMs);
}

function hit(
  map: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const next = prune(map.get(key) || [], now, windowMs);
  if (next.length >= max) {
    map.set(key, next);
    return false;
  }
  next.push(now);
  map.set(key, next);
  return true;
}

export function consumeTwilioVerifyOtpSendQuota(phone: string, ip: string): boolean {
  const phoneOk = hit(
    buckets.sendPhone,
    phone,
    MAX_SEND_PER_PHONE,
    SEND_WINDOW_MS,
  );
  if (!phoneOk) return false;
  const ipOk = hit(buckets.sendIp, ip || "unknown", MAX_SEND_PER_IP, SEND_WINDOW_MS);
  if (!ipOk) {
    const times = buckets.sendPhone.get(phone) || [];
    buckets.sendPhone.set(phone, times.slice(0, -1));
    return false;
  }
  return true;
}

export function consumeTwilioVerifyOtpCheckQuota(phone: string): boolean {
  return hit(
    buckets.verifyPhone,
    phone,
    MAX_VERIFY_PER_PHONE,
    VERIFY_WINDOW_MS,
  );
}

export function requestClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function sanitizeTwilioVerifyError(detail: string): string {
  return detail
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/AC[a-z0-9]{32}/gi, "AC[redacted]")
    .replace(/SK[a-z0-9]{32}/gi, "SK[redacted]")
    .replace(/VA[a-z0-9]{32}/gi, "VA[redacted]")
    .replace(/VE[a-z0-9]{32}/gi, "VE[redacted]")
    .replace(/(auth[_-]?token|token)[=:]\S+/gi, "$1=[redacted]")
    .slice(0, 400);
}

function parseTwilioError(raw: string, status: number): string {
  if (!raw) return `Twilio Verify error ${status}`;
  try {
    const json = JSON.parse(raw) as {
      code?: number;
      message?: string;
      status?: string;
    };
    if (json.code === 20404) return "Invalid or expired verification code.";
    if (json.code === 60200) return "Invalid phone number or verification parameter.";
    if (json.code === 60202) return "Too many verification checks for this number.";
    if (json.code === 60203) return "Maximum send attempts reached. Try again later.";
    if (json.code === 60212) return "Too many requests to Twilio Verify. Try again later.";
    if (json.message) return json.message;
  } catch {
    /* use raw */
  }
  return raw;
}

function getTwilioAuth(): { accountSid: string; authToken: string } | null {
  const accountSid = serverEnv("TWILIO_ACCOUNT_SID");
  const authToken = serverEnv("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

async function postVerify(
  path: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; raw: string }> {
  const auth = getTwilioAuth();
  const serviceSid = getTwilioVerifyServiceSid();
  if (!auth) {
    return {
      ok: false,
      status: 400,
      json: {},
      raw: JSON.stringify({
        message: `Missing ${listMissingTwilioVerifyOtpVars().join(", ")}`,
      }),
    };
  }

  const url = `https://verify.twilio.com/v2/Services/${encodeURIComponent(
    serviceSid,
  )}/${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${twilioBasicAuth({
        accountSid: auth.accountSid,
        authToken: auth.authToken,
        whatsappFrom: "",
      })}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  const raw = await response.text().catch(() => "");
  let json: Record<string, unknown> = {};
  if (raw) {
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }
  return { ok: response.ok, status: response.status, json, raw };
}

export async function sendTwilioWhatsAppVerification(
  phoneInput: string,
): Promise<TwilioVerifyOtpResult> {
  const to = normalizeIsraeliPhone(phoneInput);
  if (!to) {
    return {
      ok: false,
      action: "send",
      status: "failed",
      error: "Enter a valid Israeli mobile number (for example 052xxxxxxx or +9725xxxxxxxx).",
    };
  }

  try {
    const params = new URLSearchParams({
      To: to,
      Channel: "whatsapp",
    });
    const result = await postVerify("Verifications", params);
    if (!result.ok) {
      return {
        ok: false,
        action: "send",
        status: "failed",
        to,
        channel: "whatsapp",
        error: sanitizeTwilioVerifyError(
          parseTwilioError(result.raw, result.status),
        ),
      };
    }
    const status =
      typeof result.json.status === "string" ? result.json.status : "pending";
    return {
      ok: true,
      action: "send",
      status,
      to,
      channel: "whatsapp",
    };
  } catch (error) {
    return {
      ok: false,
      action: "send",
      status: "failed",
      to,
      channel: "whatsapp",
      error: sanitizeTwilioVerifyError(
        error instanceof Error ? error.message : "Failed to send verification code",
      ),
    };
  }
}

export async function checkTwilioWhatsAppVerification(
  phoneInput: string,
  codeInput: string,
): Promise<TwilioVerifyOtpResult> {
  const to = normalizeIsraeliPhone(phoneInput);
  const code = codeInput.trim();
  if (!to) {
    return {
      ok: false,
      action: "verify",
      status: "failed",
      error: "Enter a valid Israeli mobile number (for example 052xxxxxxx or +9725xxxxxxxx).",
    };
  }
  if (!/^\d{6}$/.test(code)) {
    return {
      ok: false,
      action: "verify",
      status: "failed",
      to,
      error: "Enter the 6-digit code from WhatsApp.",
    };
  }

  try {
    const params = new URLSearchParams({
      To: to,
      Code: code,
    });
    const result = await postVerify("VerificationCheck", params);
    if (!result.ok) {
      return {
        ok: false,
        action: "verify",
        status: "failed",
        to,
        error: sanitizeTwilioVerifyError(
          parseTwilioError(result.raw, result.status),
        ),
      };
    }
    const status =
      typeof result.json.status === "string" ? result.json.status : "";
    const valid = result.json.valid === true || status === "approved";
    return {
      ok: valid,
      action: "verify",
      status: status || (valid ? "approved" : "pending"),
      to,
      valid,
      error: valid ? undefined : "The code is incorrect or has expired.",
    };
  } catch (error) {
    return {
      ok: false,
      action: "verify",
      status: "failed",
      to,
      error: sanitizeTwilioVerifyError(
        error instanceof Error ? error.message : "Failed to verify code",
      ),
    };
  }
}
