"use client";

import { isRtl, localeLabels, type Locale } from "@/lib/i18n/config";
import { PRODUCT_CONTENT_LOCALES } from "@/lib/product-i18n";

export default function AdminContentLangSwitch({
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: Locale;
  onChange: (locale: Locale) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`admin-service-langs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {PRODUCT_CONTENT_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          role="tab"
          aria-selected={value === locale}
          className={value === locale ? "is-active" : ""}
          onClick={() => onChange(locale)}
          dir={isRtl(locale) ? "rtl" : "ltr"}
          lang={locale}
        >
          {localeLabels[locale]}
        </button>
      ))}
    </div>
  );
}
