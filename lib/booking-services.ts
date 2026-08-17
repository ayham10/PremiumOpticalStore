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
  content: LocalizedContent | undefined,
  locale: Locale,
  fallback = "",
): string {
  if (!content) return fallback;
  return content[locale]?.trim() || content.ar?.trim() || content.en?.trim() || content.he?.trim() || fallback;
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
    name: pickLocalized(service.name, locale),
    description: pickLocalized(service.description, locale),
    icon: service.icon,
    sortOrder: service.sortOrder,
  };
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
