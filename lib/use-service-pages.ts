"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useBranding } from "@/components/branding/BrandingProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { resolveServicePagesForLocale } from "@/lib/service-pages";
import type {
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

const ServicePagesPreviewContext = createContext<
  ServicePagesSettings | undefined
>(undefined);

/** Admin visual editor: inject unsaved copy into public page components. */
export function ServicePagesPreviewProvider({
  value,
  children,
}: {
  value?: ServicePagesSettings;
  children: ReactNode;
}) {
  return createElement(
    ServicePagesPreviewContext.Provider,
    { value },
    children,
  );
}

/**
 * Live service-page copy from public settings.
 * Starts from BrandingProvider, then refreshes with a no-store fetch
 * so a normal page reload shows Admin saves without a redeploy.
 * Preview context, when set, never hits the live API.
 */
export function useServicePages(): ServicePagesSettings | undefined {
  const preview = useContext(ServicePagesPreviewContext);
  const { settings } = useBranding();
  const [pages, setPages] = useState<ServicePagesSettings | undefined>(
    preview ?? settings?.servicePages,
  );

  useEffect(() => {
    if (preview) {
      setPages(preview);
      return;
    }
    setPages(settings?.servicePages);
  }, [preview, settings?.servicePages]);

  useEffect(() => {
    if (preview) return;
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
  }, [preview]);

  return preview ?? pages;
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
