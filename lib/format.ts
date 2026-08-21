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

export function formatLocalPhone(raw?: string | null): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("5") && digits.length === 9) digits = `0${digits}`;
  if (digits.startsWith("05") && digits.length >= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 10)}`;
  }
  if (digits.startsWith("0") && digits.length >= 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return raw;
}

export function phoneTelHref(raw?: string | null): string {
  const local = formatLocalPhone(raw).replace(/\D/g, "");
  const digits = local || (raw || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : "";
}

export function whatsappDialDigits(raw?: string | null): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `972${digits}`;
  return digits;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
