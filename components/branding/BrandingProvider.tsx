"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  brandingCssText,
  googleFontsHref,
  mergeBranding,
} from "@/lib/branding";
import type { BrandingSettings, StoreSettings } from "@/lib/types";

type BrandingContextValue = {
  branding: BrandingSettings;
  settings: StoreSettings | null;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyBrandingDom(branding: BrandingSettings) {
  const css = brandingCssText(branding);
  let styleEl = document.getElementById("oyon-branding-vars");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "oyon-branding-vars";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  const fontsHref = googleFontsHref(branding);
  const fontsId = "oyon-branding-fonts";
  let fontsEl = document.getElementById(fontsId) as HTMLLinkElement | null;
  if (fontsHref) {
    if (!fontsEl) {
      fontsEl = document.createElement("link");
      fontsEl.id = fontsId;
      fontsEl.rel = "stylesheet";
      document.head.appendChild(fontsEl);
    }
    if (fontsEl.href !== fontsHref) fontsEl.href = fontsHref;
  }

  const favicon = branding.favicon?.trim() || branding.logo?.trim();
  if (favicon) {
    let link = document.querySelector(
      "link[data-oyon-favicon='1']",
    ) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-oyon-favicon", "1");
      document.head.appendChild(link);
    }
    link.href = favicon;
  }

  document.documentElement.style.setProperty(
    "--brand-font-scale",
    String(branding.typography.fontScale || 1),
  );
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const branding = useMemo(
    () => mergeBranding(settings?.branding),
    [settings?.branding],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = (await res.json()) as { settings?: StoreSettings };
      if (data.settings) setSettings(data.settings);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    applyBrandingDom(branding);
  }, [branding]);

  useEffect(() => {
    function onSaved() {
      void refresh();
    }
    window.addEventListener("oyon:branding-saved", onSaved);
    return () => window.removeEventListener("oyon:branding-saved", onSaved);
  }, [refresh]);

  const value = useMemo(
    () => ({ branding, settings, refresh }),
    [branding, settings, refresh],
  );

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      branding: mergeBranding(),
      settings: null,
      refresh: async () => undefined,
    };
  }
  return ctx;
}
