import { isLocale, type Locale } from "@/lib/i18n/config";

const COLOR_MAX = 80;
const BARCODE_MAX = 64;

type ColorCopy = { en: string; ar: string; he: string };

/** Known optical colors. Keys are lowercase aliases in EN/AR/HE. */
const PRODUCT_COLORS: ColorCopy[] = [
  { en: "Black", ar: "أسود", he: "שחור" },
  { en: "White", ar: "أبيض", he: "לבן" },
  { en: "Brown", ar: "بني", he: "חום" },
  { en: "Gold", ar: "ذهبي", he: "זהב" },
  { en: "Silver", ar: "فضي", he: "כסף" },
  { en: "Gray", ar: "رمادي", he: "אפור" },
  { en: "Blue", ar: "أزرق", he: "כחול" },
  { en: "Green", ar: "أخضر", he: "ירוק" },
  { en: "Red", ar: "أحمر", he: "אדום" },
  { en: "Pink", ar: "وردي", he: "ורוד" },
  { en: "Beige", ar: "بيج", he: "בז'" },
  { en: "Transparent", ar: "شفاف", he: "שקוף" },
  { en: "Tortoise", ar: "سلحفاة", he: "טורטוז" },
  { en: "Havana", ar: "هافانا", he: "הוואנה" },
  { en: "Gunmetal", ar: "رصاصي", he: "גאנמטאל" },
  { en: "Rose gold", ar: "ذهبي وردي", he: "זהב ורוד" },
  { en: "Crystal", ar: "كريستال", he: "קריסטל" },
  { en: "Navy", ar: "كحلي", he: "נייבי" },
];

const COLOR_ALIASES: Record<string, ColorCopy> = (() => {
  const map: Record<string, ColorCopy> = {};
  for (const color of PRODUCT_COLORS) {
    for (const label of [color.en, color.ar, color.he]) {
      map[normalizeColorKey(label)] = color;
    }
  }
  if (map.gray) map.grey = map.gray;
  if (map.tortoise) map["tortoise shell"] = map.tortoise;
  if (map["rose gold"]) map["rose-gold"] = map["rose gold"];
  if (map.transparent) map.clear = map.transparent;
  return map;
})();

function normalizeColorKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ـ]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Public display only. Stored color is unchanged.
 * Translates known colors to the visitor locale; unknown values stay as entered.
 */
export function formatProductColorPublic(
  value: unknown,
  locale?: string,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = COLOR_ALIASES[normalizeColorKey(trimmed)];
  if (!match) return trimmed;
  const lang: Locale = isLocale(locale) ? locale : "en";
  return match[lang];
}

export function sanitizeProductColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, COLOR_MAX);
  return trimmed || undefined;
}

export function sanitizeBarcode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, BARCODE_MAX);
  return trimmed || undefined;
}

/** Keep raw digits/hyphen while typing. Valid if empty or two numeric groups. */
export function isFrameSizeInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^\d{1,4}\s*[-–]\s*\d{1,4}$/.test(trimmed) || /^\d{0,4}-?\d{0,4}$/.test(trimmed);
}

/**
 * `052-018` → `52-018`. First group drops leftover leading zeros;
 * second group keeps its typed digits (including meaningful zeros).
 */
export function normalizeFrameSize(value: unknown): string | undefined | null {
  if (value == null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (!match) return null;
  const first = String(Number.parseInt(match[1], 10));
  const second = match[2];
  if (!first || !second) return null;
  return `${first}-${second}`;
}

export function sanitizeFrameSize(value: unknown): string | undefined {
  const normalized = normalizeFrameSize(value);
  if (normalized === null) return undefined;
  return normalized;
}

/**
 * Public display only. Stored value is unchanged.
 * `018-052` → `18/52`, `051/015` → `51/15`.
 */
export function formatFrameSizePublic(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d+)\s*[-–*/]\s*(\d+)$/);
  if (!match) return trimmed;
  const first = String(Number.parseInt(match[1], 10));
  const second = String(Number.parseInt(match[2], 10));
  if (!first || !second) return trimmed;
  return `${first}/${second}`;
}
