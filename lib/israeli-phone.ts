/** Normalize Israeli mobile numbers to +9725XXXXXXXX */
export function normalizeIsraeliPhone(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  digits = digits.replace(/\D/g, "");

  if (digits.startsWith("972")) {
    const rest = digits.slice(3);
    if (/^5\d{8}$/.test(rest)) return `+972${rest}`;
    return null;
  }

  if (digits.startsWith("0") && /^05\d{8}$/.test(digits)) {
    return `+972${digits.slice(1)}`;
  }

  if (/^5\d{8}$/.test(digits)) {
    return `+972${digits}`;
  }

  return null;
}
