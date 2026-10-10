import { serverEnv } from "@/lib/twilio/config";
import { sanitizeTwilioContentSid } from "@/lib/twilio/content-sid-format";

export { sanitizeTwilioContentSid };

/** Dedicated Vercel env vars → approved template names. Never hardcode HX SIDs. */
export const TWILIO_DEDICATED_CONTENT_SID_ENV: Record<string, string> = {
  oyon_booking_manage_v2_he: "TWILIO_TEMPLATE_BOOKING_HE",
  oyon_booking_manage_v2_ar: "TWILIO_TEMPLATE_BOOKING_AR",
  oyon_booking_rescheduled_owner: "TWILIO_TEMPLATE_OWNER_RESCHEDULED",
  oyon_booking_cancelled_owner: "TWILIO_TEMPLATE_OWNER_CANCELLED",
};

let cachedMap: Map<string, string> | null = null;

export function resolveDedicatedTwilioContentSid(
  templateName: string,
): string | null {
  const envName = TWILIO_DEDICATED_CONTENT_SID_ENV[templateName.trim()];
  if (!envName) return null;
  return sanitizeTwilioContentSid(serverEnv(envName));
}

function parseContentSidMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const trimmed = raw.trim();
  if (!trimmed) return map;

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [name, sid] of Object.entries(parsed)) {
        const key = name.trim();
        const value = typeof sid === "string" ? sid.trim() : "";
        if (key && value) map.set(key, value);
      }
      return map;
    } catch {
      return map;
    }
  }

  for (const entry of trimmed.split(",")) {
    const piece = entry.trim();
    if (!piece) continue;
    const sep = piece.indexOf(":");
    if (sep <= 0) continue;
    const name = piece.slice(0, sep).trim();
    const sid = piece.slice(sep + 1).trim();
    if (name && sid) map.set(name, sid);
  }

  return map;
}

export function getTwilioContentSidMap(): Map<string, string> {
  if (cachedMap) return cachedMap;
  cachedMap = parseContentSidMap(serverEnv("TWILIO_WHATSAPP_CONTENT_SIDS"));
  return cachedMap;
}

export function resetTwilioContentSidMapForTests(): void {
  cachedMap = null;
}

export function resolveTwilioContentSid(templateName: string): string | null {
  const name = templateName.trim();
  if (!name) return null;
  return (
    resolveDedicatedTwilioContentSid(name) ||
    getTwilioContentSidMap().get(name) ||
    null
  );
}
