import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/twilio/config";

export type WebhookVerification =
  | { ok: true; source: "twilio" | "meta" }
  | {
      ok: false;
      reason: "missing-signature" | "invalid-signature" | "missing-secret";
    };

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseFormBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

export function webhookCandidateUrls(request: Request): string[] {
  const urls = new Set<string>();
  try {
    const parsed = new URL(request.url);
    urls.add(parsed.toString());
    const proto = (
      request.headers.get("x-forwarded-proto") ||
      parsed.protocol.replace(":", "")
    ).replace(/:$/, "");
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      parsed.host;
    if (proto && host) {
      urls.add(`${proto}://${host}${parsed.pathname}${parsed.search}`);
    }
  } catch {
    /* ignore malformed request URL */
  }
  const configured = serverEnv("TWILIO_WEBHOOK_URL");
  if (configured) urls.add(configured);
  return [...urls];
}

export function signTwilioForm(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function signTwilioRawBody(
  authToken: string,
  url: string,
  rawBody: string,
): string {
  return createHmac("sha1", authToken)
    .update(url + rawBody, "utf8")
    .digest("base64");
}

export function verifyTwilioSignature(opts: {
  authToken: string;
  signature: string;
  urls: string[];
  params: Record<string, string>;
  rawBody: string;
}): boolean {
  for (const url of opts.urls) {
    if (safeEqual(signTwilioForm(opts.authToken, url, opts.params), opts.signature)) {
      return true;
    }
    if (safeEqual(signTwilioRawBody(opts.authToken, url, opts.rawBody), opts.signature)) {
      return true;
    }
  }
  return false;
}

export function signMetaRawBody(appSecret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifyMetaSignature(
  appSecret: string,
  rawBody: string,
  header: string,
): boolean {
  return safeEqual(signMetaRawBody(appSecret, rawBody), header.trim());
}

export function verifyIncomingWebhook(
  request: Request,
  rawBody: string,
): WebhookVerification {
  const twilioSig = request.headers.get("x-twilio-signature")?.trim();
  const metaSig = request.headers.get("x-hub-signature-256")?.trim();
  const twilioToken = serverEnv("TWILIO_AUTH_TOKEN");
  const metaSecret = serverEnv("WHATSAPP_APP_SECRET");

  if (twilioSig) {
    if (!twilioToken) return { ok: false, reason: "missing-secret" };
    const contentType = request.headers.get("content-type") || "";
    const params = contentType.includes("application/x-www-form-urlencoded")
      ? parseFormBody(rawBody)
      : {};
    const valid = verifyTwilioSignature({
      authToken: twilioToken,
      signature: twilioSig,
      urls: webhookCandidateUrls(request),
      params,
      rawBody,
    });
    return valid
      ? { ok: true, source: "twilio" }
      : { ok: false, reason: "invalid-signature" };
  }

  if (metaSig) {
    if (!metaSecret) return { ok: false, reason: "missing-secret" };
    return verifyMetaSignature(metaSecret, rawBody, metaSig)
      ? { ok: true, source: "meta" }
      : { ok: false, reason: "invalid-signature" };
  }

  return { ok: false, reason: "missing-signature" };
}
