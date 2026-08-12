"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { locales, localeLabels, type Locale } from "@/lib/i18n/config";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function LanguageSwitcher({
  compact = false,
  tone = "auto",
  variant = "select",
}: {
  compact?: boolean;
  tone?: "auto" | "light" | "dark";
  variant?: "select" | "dropdown";
}) {
  const { locale, setLocale, pending, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const toneClass =
    tone === "dark"
      ? "lang-switch lang-switch-dark"
      : tone === "light"
        ? "lang-switch lang-switch-light"
        : "lang-switch";

  useEffect(() => {
    if (!open || variant !== "dropdown") return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  if (variant === "dropdown") {
    return (
      <div
        ref={rootRef}
        className={`lang-switch-menu ${tone === "dark" ? "is-dark" : tone === "light" ? "is-light" : ""}`}
      >
        <button
          type="button"
          className={`lang-switch-menu-btn ${toneClass}`}
          aria-label={t("nav.language")}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={pending}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="lang-switch-menu-label">{localeLabels[locale]}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.8}
            className={`lang-switch-menu-chevron${open ? " is-open" : ""}`}
            aria-hidden
          />
        </button>
        {open ? (
          <ul
            id={listId}
            className="lang-switch-menu-list"
            role="listbox"
            aria-label={t("nav.language")}
          >
            {locales.map((code) => {
              const active = code === locale;
              return (
                <li key={code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={`lang-switch-menu-option${active ? " is-active" : ""}`}
                    disabled={pending || active}
                    onClick={() => {
                      setLocale(code);
                      setOpen(false);
                    }}
                  >
                    {localeLabels[code]}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

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
