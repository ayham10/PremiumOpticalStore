export const locales = ["en", "he", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const rtlLocales: Locale[] = ["he", "ar"];
export const LOCALE_COOKIE = "lumina_locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  he: "עברית",
  ar: "العربية",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
