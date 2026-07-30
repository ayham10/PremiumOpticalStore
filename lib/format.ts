import type { StoreSettings } from "@/lib/types";

export function formatPrice(
  amount: number,
  settings?: Pick<StoreSettings, "currencySymbol">
): string {
  const symbol = settings?.currencySymbol || "₪";
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

export function formatDate(date: string): string {
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
