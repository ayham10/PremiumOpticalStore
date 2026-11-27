/** Google Analytics 4 measurement ID (public client-side identifier). */
export const OYON_GA_MEASUREMENT_ID = "G-KMS1H8EZLQ";

const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;

export function isValidGaMeasurementId(value: string): boolean {
  return GA_ID_PATTERN.test(value.trim());
}

/**
 * Resolved GA4 id for the public site. Env overrides default.
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID=off to disable tracking (e.g. staging).
 */
export function getGoogleAnalyticsId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (raw === "off" || raw === "false" || raw === "0") return null;
  if (raw && isValidGaMeasurementId(raw)) return raw;
  if (raw) return null;
  return OYON_GA_MEASUREMENT_ID;
}