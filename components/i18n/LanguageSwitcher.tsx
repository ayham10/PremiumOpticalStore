"use client";

import { locales, localeLabels, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale, pending, t } = useLocale();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      {!compact && (
        <span className="sr-only">{t("nav.language")}</span>
      )}
      <select
        className="min-h-10 rounded-full border border-[var(--line-strong)] bg-white/80 px-3 py-1.5 text-sm font-medium text-[var(--ink)] outline-none transition hover:border-[var(--accent)] focus:border-[var(--accent)]"
        value={locale}
        disabled={pending}
        aria-label={t("nav.language")}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
