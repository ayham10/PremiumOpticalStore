import type { Locale } from "@/lib/i18n/config";

export type TranslateTextFn = (
  text: string,
  from: Locale | "auto",
  to: Locale,
) => Promise<string>;

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";

/**
 * Free MyMemory translation (no API key). Paid DeepL / Google Cloud Translate
 * are intentionally not wired — those would need owner approval for usage cost
 * (~$20 / million characters on DeepL Pro API, similar on Google Cloud).
 */
export async function translateText(
  text: string,
  from: Locale | "auto",
  to: Locale,
): Promise<string> {
  const source = text.trim();
  if (!source) return "";
  if (from === to) return source;

  const langpair = `${from === "auto" ? "Autodetect" : from}|${to}`;
  const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(source)}&langpair=${encodeURIComponent(langpair)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return source;
    const body = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const translated = body.responseData?.translatedText?.trim();
    if (!translated || body.responseStatus !== 200) return source;
    // MyMemory sometimes echoes QUOTA EXCEEDED into the text.
    if (/quota\s*exceeded/i.test(translated)) return source;
    return translated;
  } catch {
    return source;
  } finally {
    clearTimeout(timer);
  }
}
