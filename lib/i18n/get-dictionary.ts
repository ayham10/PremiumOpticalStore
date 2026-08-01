import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const dictionaries: Record<Locale, () => Promise<{ default: Dictionary }>> = {
  en: () => import("@/lib/i18n/dictionaries/en"),
  he: () => import("@/lib/i18n/dictionaries/he"),
  ar: () => import("@/lib/i18n/dictionaries/ar"),
};

export async function getLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = headerStore.get("x-lumina-locale");
  if (isLocale(fromHeader)) return fromHeader;

  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return defaultLocale;
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  const resolved = locale ?? (await getLocale());
  const mod = await dictionaries[resolved]();
  return mod.default;
}
