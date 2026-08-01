"use client";

import { locales, localeLabels, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function LanguageSwitcher({
  compact = false,
  tone = "auto",
}: {
  compact?: boolean;
  tone?: "auto" | "light" | "dark";
}) {
  const { locale, setLocale, pending, t } = useLocale();

  const toneClass =
    tone === "dark"
      ? "lang-switch lang-switch-dark"
      : tone === "light"
        ? "lang-switch lang-switch-light"
        : "lang-switch";

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      {!compact ? <span className="sr-only">{t("nav.language")}</span> : null}
      <select
        className={toneClass}
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
