"use client";

import { useEffect, useMemo, useState } from "react";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { resolveServicePagesForLocale } from "@/lib/service-pages";
import type {
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

/**
 * Live service-page copy from public settings.
 * Starts from BrandingProvider, then refreshes with a no-store fetch
 * so a normal page reload shows Admin saves without a redeploy.
 */
export function useServicePages(): ServicePagesSettings | undefined {
  const { settings } = useBranding();
  const [pages, setPages] = useState<ServicePagesSettings | undefined>(
    settings?.servicePages,
  );

  useEffect(() => {
    setPages(settings?.servicePages);
  }, [settings?.servicePages]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { settings?: { servicePages?: ServicePagesSettings } }) => {
        if (!cancelled) setPages(data.settings?.servicePages);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return pages;
}

/** Locale-resolved copy. Falls back to dictionaries when a language was never saved. */
export function useLocalizedServicePages(): ServicePagesLocaleBundle | undefined {
  const { locale } = useLocale();
  const pages = useServicePages();
  return useMemo(
    () => resolveServicePagesForLocale(pages, locale),
    [pages, locale],
  );
}
