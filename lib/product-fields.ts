const COLOR_MAX = 80;
const BARCODE_MAX = 64;

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
 * `018-052` → `18*52`, `052-018` → `52*18`.
 */
export function formatFrameSizePublic(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d+)\s*[-–*]\s*(\d+)$/);
  if (!match) return trimmed;
  const first = String(Number.parseInt(match[1], 10));
  const second = String(Number.parseInt(match[2], 10));
  if (!first || !second) return trimmed;
  return `${first}*${second}`;
}
