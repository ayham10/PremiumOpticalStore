"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { isRtl, type Locale } from "@/lib/i18n/config";
import { t as translate } from "@/lib/i18n/t";

type LocaleContextValue = {
  locale: Locale;
  dict: Dictionary;
  rtl: boolean;
  t: (path: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  pending: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      startTransition(async () => {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        document.documentElement.lang = next;
        document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
        try {
          localStorage.setItem("lumina_locale", next);
        } catch {
          /* ignore */
        }
        router.refresh();
      });
    },
    [router]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dict,
      rtl: isRtl(locale),
      t: (path, vars) => translate(dict as never, path, vars),
      setLocale,
      pending,
    }),
    [locale, dict, setLocale, pending]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
