import type { BookingService, LocalizedContent } from "@/lib/types";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const BUILTIN_CLINIC_APPOINTMENT_TYPES = [
  "eye_exam",
  "contact_lens_fitting",
  "frame_consultation",
  "sunglasses_consultation",
] as const;

export const BOOKING_SERVICE_ICON_IDS = [
  "eye",
  "contact-lenses",
  "glasses",
  "sun",
  "stethoscope",
  "calendar",
  "heart",
  "star",
  "message-circle",
  "sparkles",
] as const;

export type BookingServiceIconId = (typeof BOOKING_SERVICE_ICON_IDS)[number];

const BOOKING_SERVICE_KEY_RE = /^[a-z][a-z0-9_]{0,50}$/;

export function isBookingServiceKey(value: unknown): value is string {
  return typeof value === "string" && BOOKING_SERVICE_KEY_RE.test(value);
}

export function pickLocalized(
  content: LocalizedContent | string | null | undefined,
  locale: Locale,
  fallback = "",
): string {
  if (content == null) return fallback;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed || fallback;
  }
  if (typeof content !== "object") return fallback;
  const fromLocale = content[locale];
  if (typeof fromLocale === "string" && fromLocale.trim()) {
    return fromLocale.trim();
  }
  for (const key of ["ar", "en", "he"] as const) {
    const value = content[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

export function sortBookingServices(services: BookingService[]): BookingService[] {
  return services.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

export function activeBookingServices(services: BookingService[]): BookingService[] {
  return sortBookingServices(services.filter((s) => s.active));
}

export function mergeSeedBookingServices(existing: BookingService[] | undefined): BookingService[] {
  const seed = createDefaultBookingServices();
  const byKey = new Map((existing || []).map((s) => [s.key, s]));
  for (const row of seed) {
    if (!byKey.has(row.key)) byKey.set(row.key, row);
  }
  return sortBookingServices(Array.from(byKey.values()));
}

export function createDefaultBookingServices(now = new Date().toISOString()): BookingService[] {
  return [
    {
      id: "bsvc-eye-exam",
      key: "eye_exam",
      name: {
        ar: "فحص النظر",
        en: "Eye Exam",
        he: "בדיקת עיניים",
      },
      description: {
        ar: "فحص نظر احترافي",
        en: "Professional vision examination",
        he: "בדיקת ראייה מקצועית",
      },
      icon: "eye",
      sortOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bsvc-contact-lens",
      key: "contact_lens_fitting",
      name: {
        ar: "ملاءمة العدسات اللاصقة",
        en: "Contact Lens Fitting",
        he: "התאמת עדשות מגע",
      },
      description: {
        ar: "ملاءمة وإرشاد للعدسات اللاصقة",
        en: "Fitting and guidance for contacts",
        he: "התאמה והכוונה לעדשות מגע",
      },
      icon: "contact-lenses",
      sortOrder: 2,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bsvc-frame",
      key: "frame_consultation",
      name: {
        ar: "استشارة الإطارات",
        en: "Frame Consultation",
        he: "ייעוץ מסגרות",
      },
      description: {
        ar: "اختيار الإطار المناسب لك",
        en: "Find the right frame for you",
        he: "מצאו את המסגרת המתאימה",
      },
      icon: "glasses",
      sortOrder: 3,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "bsvc-sunglasses",
      key: "sunglasses_consultation",
      name: {
        ar: "استشارة النظارات الشمسية",
        en: "Sunglasses Consultation",
        he: "ייעוץ משקפי שמש",
      },
      description: {
        ar: "نصائح للأناقة والحماية من الشمس",
        en: "Style and sun protection advice",
        he: "ייעוץ לסטייל והגנה מהשמש",
      },
      icon: "sun",
      sortOrder: 4,
      active: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function serializePublicBookingService(
  service: BookingService,
  locale: Locale,
) {
  return {
    key: service.key,
    name: pickLocalized(service.name, locale, service.key),
    description: pickLocalized(service.description, locale),
    icon: typeof service.icon === "string" ? service.icon : "calendar",
    sortOrder: Number(service.sortOrder) || 0,
  };
}

export function normalizePublicBookingServices(
  raw: unknown,
  locale: Locale,
): Array<{
  key: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
}> {
  const list = Array.isArray(raw)
    ? raw
    : raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { services?: unknown }).services)
      ? ((raw as { services: unknown[] }).services)
      : [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const key = typeof row.key === "string" ? row.key.trim() : "";
      if (!isBookingServiceKey(key)) return null;
      return {
        key,
        name: pickLocalized(
          row.name as LocalizedContent | string | undefined,
          locale,
          key,
        ),
        description: pickLocalized(
          row.description as LocalizedContent | string | undefined,
          locale,
        ),
        icon: typeof row.icon === "string" ? row.icon : "calendar",
        sortOrder: Number(row.sortOrder) || 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export function resolveBookingServiceLocale(
  value: string | null | undefined,
): Locale {
  return isLocale(value) ? value : "ar";
}

export function isActiveBookingServiceKey(
  key: string,
  services: BookingService[],
): boolean {
  return activeBookingServices(services).some((s) => s.key === key);
}

export function bookingServiceLabel(
  key: string,
  services: BookingService[],
  locale: Locale = "ar",
): string {
  const row = services.find((s) => s.key === key);
  if (row) return pickLocalized(row.name, locale, key);
  return key;
}
