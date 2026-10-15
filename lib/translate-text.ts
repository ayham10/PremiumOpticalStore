import type { Locale } from "@/lib/i18n/config";

export type TranslateTextFn = (
  text: string,
  from: Locale | "auto",
  to: Locale,
) => Promise<string>;

export type TranslationFailure = {
  locale: Locale;
  path: string;
  error: string;
};

export class TranslationFailedError extends Error {
  constructor(message = "TRANSLATION_FAILED") {
    super(message);
    this.name = "TranslationFailedError";
  }
}

const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";

/** Arabic / Hebrew script left in a different locale is an untranslated echo. */
export function looksUntranslated(text: string, to: Locale): boolean {
  const value = text.trim();
  if (!value) return false;
  const hasArabic = /[\u0600-\u06FF]/.test(value);
  const hasHebrew = /[\u0590-\u05FF]/.test(value);
  if (to === "he" && hasArabic && !hasHebrew) return true;
  if (to === "en" && (hasArabic || hasHebrew)) return true;
  if (to === "ar" && hasHebrew && !hasArabic) return true;
  return false;
}

export function shouldTranslateField(opts: {
  source: string;
  previous?: string;
  target?: string;
  targetLocale: Locale;
  fillMissing: boolean;
  targetOrigin?: "machine" | "manual";
  overwriteManual?: boolean;
}): boolean {
  const source = (opts.source || "").trim();
  if (!source) return false;
  if (opts.overwriteManual) return true;
  if (opts.targetOrigin === "manual") return false;
  const target = (opts.target || "").trim();
  const previous = (opts.previous || "").trim();
  if (target && looksUntranslated(target, opts.targetLocale)) return true;
  if (opts.targetOrigin === "machine") {
    if (!target) return true;
    return source !== previous;
  }
  if (!target) return opts.fillMissing || source !== previous;
  if (source === previous) return false;
  if (target === previous || target === source) return true;
  return false;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, () => run()));
  return results;
}

/**
 * Free MyMemory translation (no API key). Paid DeepL / Google Cloud Translate
 * are intentionally not wired — those would need owner approval for usage cost
 * (~$20 / million characters on DeepL Pro API, similar on Google Cloud).
 *
 * Failures throw so callers can persist successful locales and retry the rest.
 * The source text is never returned as a fake translation.
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
    if (!res.ok) {
      throw new TranslationFailedError(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const translated = body.responseData?.translatedText?.trim();
    if (!translated || body.responseStatus !== 200) {
      throw new TranslationFailedError(
        `status ${body.responseStatus ?? "unknown"}`,
      );
    }
    if (/quota\s*exceeded/i.test(translated)) {
      throw new TranslationFailedError("quota exceeded");
    }
    return translated;
  } catch (error) {
    if (error instanceof TranslationFailedError) throw error;
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message
          : "translate failed";
    throw new TranslationFailedError(message);
  } finally {
    clearTimeout(timer);
  }
}
