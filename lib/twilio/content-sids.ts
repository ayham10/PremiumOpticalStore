import { serverEnv } from "@/lib/twilio/config";

let cachedMap: Map<string, string> | null = null;

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

export function resolveTwilioContentSid(templateName: string): string | null {
  const name = templateName.trim();
  if (!name) return null;
  return getTwilioContentSidMap().get(name) || null;
}
