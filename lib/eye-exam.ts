import { newId } from "@/lib/auth";
import {
  BUILTIN_CLINIC_APPOINTMENT_TYPES,
  isBookingServiceKey,
} from "@/lib/booking-services";
import type {
  ClinicAppointmentType,
  EyeExamAppointment,
  EyeExamAvailability,
  EyeExamTimeSlot,
  StoreSettings,
  WorkingHours,
  WorkingPeriod,
} from "@/lib/types";

export const CLINIC_APPOINTMENT_TYPES: ClinicAppointmentType[] = [
  ...BUILTIN_CLINIC_APPOINTMENT_TYPES,
];

export function isClinicAppointmentType(
  value: unknown,
): value is ClinicAppointmentType {
  return isBookingServiceKey(value);
}

export function normalizeAppointmentType(
  value?: string | null,
): ClinicAppointmentType {
  return isClinicAppointmentType(value) ? value : "eye_exam";
}

/** Empty/undefined = shared day for all services; otherwise listed services only. */
export function daySupportsService(
  day: EyeExamAvailability,
  type: ClinicAppointmentType,
): boolean {
  const services = day.services?.filter(isClinicAppointmentType) || [];
  if (services.length === 0) return true;
  return services.includes(type);
}

export function isSharedAvailabilityDay(day: EyeExamAvailability): boolean {
  const services = day.services?.filter(isClinicAppointmentType) || [];
  if (services.length === 0) return true;
  return CLINIC_APPOINTMENT_TYPES.every((type) => services.includes(type));
}

export const EYE_EXAM_TZ = "Asia/Jerusalem";
export const EYE_EXAM_START_MINUTES = 8 * 60 + 30; // 08:30
export const EYE_EXAM_END_MINUTES = 21 * 60; // 21:00

const ACTIVE_STATUSES = new Set(["confirmed", "completed", "no-show"]);

export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function generateEyeExamSlotTimes(intervalMinutes = 30): string[] {
  const interval = Math.max(5, Math.min(120, intervalMinutes || 30));
  const slots: string[] = [];
  for (
    let minute = EYE_EXAM_START_MINUTES;
    minute <= EYE_EXAM_END_MINUTES;
    minute += interval
  ) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}

export function buildDefaultSlots(intervalMinutes = 30): EyeExamTimeSlot[] {
  return generateEyeExamSlotTimes(intervalMinutes).map((time) => ({
    id: newId("slot"),
    time,
    isEnabled: true,
  }));
}

/** Today's calendar date in Asia/Jerusalem as YYYY-MM-DD */
export function todayInJerusalem(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EYE_EXAM_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current HH:mm in Asia/Jerusalem */
export function nowTimeInJerusalem(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: EYE_EXAM_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Display YYYY-MM-DD as DD/MM/YY without timezone shifts */
export function formatEyeExamDateDisplay(isoDate: string): string {
  if (!isValidIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

export function sanitizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function isActiveEyeExamBooking(status: EyeExamAppointment["status"]) {
  return ACTIVE_STATUSES.has(status);
}

export function hasEyeExamSlotConflict(
  appointments: EyeExamAppointment[],
  date: string,
  time: string,
  excludeId?: string,
  opts?: {
    appointmentType?: ClinicAppointmentType;
    day?: EyeExamAvailability;
  },
): boolean {
  const type = normalizeAppointmentType(opts?.appointmentType);
  const shared = opts?.day ? isSharedAvailabilityDay(opts.day) : true;

  return appointments.some((a) => {
    if (a.id === excludeId) return false;
    if (a.appointmentDate !== date || a.appointmentTime !== time) return false;
    if (!isActiveEyeExamBooking(a.status)) return false;
    if (shared) return true;
    return normalizeAppointmentType(a.appointmentType) === type;
  });
}

export function getOpenAvailabilityForDate(
  days: EyeExamAvailability[],
  date: string,
  appointmentType: ClinicAppointmentType = "eye_exam",
): EyeExamAvailability | undefined {
  return days.find(
    (day) =>
      day.date === date &&
      day.isOpen &&
      daySupportsService(day, appointmentType),
  );
}

export function listBookableTimes(
  day: EyeExamAvailability,
  appointments: EyeExamAppointment[],
  opts?: {
    includePastToday?: boolean;
    now?: Date;
    appointmentType?: ClinicAppointmentType;
  },
): string[] {
  const today = todayInJerusalem(opts?.now);
  const currentTime = nowTimeInJerusalem(opts?.now);
  const appointmentType = normalizeAppointmentType(opts?.appointmentType);

  return day.slots
    .filter((slot) => slot.isEnabled)
    .filter(
      (slot) =>
        !hasEyeExamSlotConflict(appointments, day.date, slot.time, undefined, {
          appointmentType,
          day,
        }),
    )
    .filter((slot) => {
      if (opts?.includePastToday) return true;
      if (day.date > today) return true;
      if (day.date < today) return false;
      return slot.time > currentTime;
    })
    .map((slot) => slot.time)
    .sort();
}

export function eyeExamSmsBody(
  language: "en" | "he" | "ar",
  dateDisplay: string,
  time: string,
  appointmentType: ClinicAppointmentType = "eye_exam",
): string {
  const brand =
    language === "ar" ? "عيون للبصريات" : language === "he" ? "עיון אופטיקה" : "Oyon Optical";

  const serviceEn: Record<ClinicAppointmentType, string> = {
    eye_exam: "eye exam",
    contact_lens_fitting: "contact lens fitting",
    frame_consultation: "frame consultation",
    sunglasses_consultation: "sunglasses consultation",
  };
  const serviceAr: Record<ClinicAppointmentType, string> = {
    eye_exam: "فحص النظر",
    contact_lens_fitting: "ملاءمة العدسات اللاصقة",
    frame_consultation: "استشارة الإطارات",
    sunglasses_consultation: "استشارة النظارات الشمسية",
  };
  const serviceHe: Record<ClinicAppointmentType, string> = {
    eye_exam: "בדיקת העיניים",
    contact_lens_fitting: "התאמת עדשות המגע",
    frame_consultation: "ייעוץ מסגרות",
    sunglasses_consultation: "ייעוץ משקפי שמש",
  };

  if (language === "ar") {
    return `تم تأكيد موعد ${serviceAr[appointmentType]} بتاريخ ${dateDisplay} الساعة ${time}. ${brand}.`;
  }
  if (language === "he") {
    return `${serviceHe[appointmentType]} שלך אושר/ה לתאריך ${dateDisplay} בשעה ${time}. ${brand}.`;
  }
  return `Your ${serviceEn[appointmentType]} is confirmed for ${dateDisplay} at ${time}. ${brand}.`;
}

/** Simple in-process queue to reduce double-book races on a single instance */
let storeLock: Promise<void> = Promise.resolve();

export async function withEyeExamLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = storeLock;
  storeLock = previous.then(() => gate);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function weekdayUtc(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getOpeningHoursForWeekday(
  openingHours: WorkingHours[],
  weekday: number,
): WorkingHours | undefined {
  return openingHours.find((h) => h.day === weekday);
}

export function buildPeriodsFromOpeningHours(
  hours: WorkingHours | undefined,
): WorkingPeriod[] {
  if (!hours || hours.closed) return [];
  const start = parseTimeToMinutes(hours.open);
  const end = parseTimeToMinutes(hours.close);
  if (start == null || end == null || end <= start) return [];
  return [
    {
      id: newId("period"),
      start: hours.open,
      end: hours.close,
      enabled: true,
    },
  ];
}

export function buildSlotsFromPeriodRange(
  start: string,
  end: string,
  intervalMinutes = 30,
  enabled = true,
): EyeExamTimeSlot[] {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin == null || endMin == null || endMin <= startMin) return [];
  const interval = Math.max(5, Math.min(120, intervalMinutes || 30));
  const slots: EyeExamTimeSlot[] = [];
  for (let minute = startMin; minute < endMin; minute += interval) {
    slots.push({
      id: newId("slot"),
      time: minutesToTime(minute),
      isEnabled: enabled,
    });
  }
  return slots;
}

export function buildSlotsFromPeriods(
  periods: WorkingPeriod[],
  intervalMinutes = 30,
): EyeExamTimeSlot[] {
  const byTime = new Map<string, EyeExamTimeSlot>();
  for (const period of periods) {
    const generated = buildSlotsFromPeriodRange(
      period.start,
      period.end,
      intervalMinutes,
      period.enabled,
    );
    for (const slot of generated) {
      const existing = byTime.get(slot.time);
      if (!existing) {
        byTime.set(slot.time, slot);
      } else if (slot.isEnabled) {
        existing.isEnabled = true;
      }
    }
  }
  return Array.from(byTime.values()).sort((a, b) =>
    a.time.localeCompare(b.time),
  );
}

export function inferPeriodsFromSlots(slots: EyeExamTimeSlot[]): WorkingPeriod[] {
  const enabled = slots
    .filter((s) => s.isEnabled)
    .map((s) => s.time)
    .sort();
  if (!enabled.length) {
    const all = slots.map((s) => s.time).sort();
    if (!all.length) return [];
    return [
      {
        id: newId("period"),
        start: all[0],
        end: minutesToTime((parseTimeToMinutes(all[all.length - 1]) || 0) + 30),
        enabled: false,
      },
    ];
  }

  const periods: WorkingPeriod[] = [];
  let runStart = enabled[0];
  let prev = enabled[0];
  for (let i = 1; i <= enabled.length; i++) {
    const cur = enabled[i];
    const prevMin = parseTimeToMinutes(prev) || 0;
    const curMin = cur ? parseTimeToMinutes(cur) : null;
    const gap = curMin == null ? Infinity : curMin - prevMin;
    if (gap > 60 || curMin == null) {
      periods.push({
        id: newId("period"),
        start: runStart,
        end: minutesToTime(prevMin + 30),
        enabled: true,
      });
      if (cur) {
        runStart = cur;
        prev = cur;
      }
    } else {
      prev = cur;
    }
  }
  return periods;
}

export function periodsForDay(
  day: EyeExamAvailability,
): WorkingPeriod[] {
  if (day.periods && day.periods.length) return day.periods;
  return inferPeriodsFromSlots(day.slots);
}

export function buildDefaultSlotsFromOpeningHours(
  openingHours: WorkingHours[],
  isoDate: string,
  intervalMinutes = 30,
): { isOpen: boolean; periods: WorkingPeriod[]; slots: EyeExamTimeSlot[] } {
  const weekday = weekdayUtc(isoDate);
  const hours = getOpeningHoursForWeekday(openingHours, weekday);
  if (!hours || hours.closed) {
    return { isOpen: false, periods: [], slots: [] };
  }
  const periods = buildPeriodsFromOpeningHours(hours);
  const slots = buildSlotsFromPeriods(periods, intervalMinutes);
  return { isOpen: slots.length > 0, periods, slots };
}

/**
 * Resolve one calendar day for public booking:
 * - exception closed → unavailable
 * - exception with custom hours → those periods/slots
 * - otherwise → weekly opening hours (auto-open working days)
 */
export function resolveAvailabilityDay(
  existing: EyeExamAvailability | undefined,
  settings: StoreSettings,
  isoDate: string,
  now = new Date().toISOString(),
): EyeExamAvailability | null {
  const interval = settings.appointmentSlotMinutes || 30;

  if (existing?.isException) {
    if (!existing.isOpen) {
      return { ...existing, isOpen: false };
    }

    const periods = periodsForDay(existing);
    const slots = periods.length
      ? buildSlotsFromPeriods(periods, interval)
      : existing.slots.slice();

    return {
      ...existing,
      isOpen: true,
      periods,
      slots: slots.length ? slots : existing.slots,
      isException: true,
    };
  }

  const generated = buildDefaultSlotsFromOpeningHours(
    settings.openingHours || [],
    isoDate,
    interval,
  );

  if (!generated.isOpen || !generated.slots.length) {
    return null;
  }

  return {
    id: existing?.id || newId("exa"),
    date: isoDate,
    isOpen: true,
    periods: generated.periods,
    slots: generated.slots,
    isException: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

/** Public booking window ends on this inclusive calendar date (Asia/Jerusalem). */
export const PUBLIC_BOOKING_HORIZON_END = "2027-12-31";

/** Days loaded for normal public booking calendar reads (not the hard book limit). */
export const PUBLIC_BOOKING_CALENDAR_DAYS = 90;

/** Inclusive end date for booking rules / admin materialization (full horizon). */
export function publicBookingMaxDate(today = todayInJerusalem()): string {
  return today > PUBLIC_BOOKING_HORIZON_END ? today : PUBLIC_BOOKING_HORIZON_END;
}

/** Inclusive end date for public calendar / dates-list reads (~60–90 days). */
export function publicBookingCalendarMaxDate(
  today = todayInJerusalem(),
): string {
  const end = addDaysIso(today, PUBLIC_BOOKING_CALENDAR_DAYS);
  const hard = publicBookingMaxDate(today);
  return end < hard ? end : hard;
}

/**
 * Read-path availability for public booking calendar (next ~90 days).
 * Driven by the weekly working schedule + manual exceptions — not by
 * manually opened availability rows.
 */
export function resolvePublicAvailability(
  availability: EyeExamAvailability[],
  settings: StoreSettings,
): EyeExamAvailability[] {
  const today = todayInJerusalem();
  const maxDate = publicBookingCalendarMaxDate(today);
  const byDate = new Map(availability.map((d) => [d.date, d]));
  const now = new Date().toISOString();
  const next: EyeExamAvailability[] = [];

  for (let date = today; date <= maxDate; date = addDaysIso(date, 1)) {
    const existing = byDate.get(date);
    byDate.delete(date);

    const resolved = resolveAvailabilityDay(existing, settings, date, now);
    if (resolved) next.push(resolved);
  }

  // Keep out-of-range / past exceptions for admin continuity
  for (const day of byDate.values()) {
    if (day.isException) next.push(day);
  }

  return next.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Persist availability rows from today through the public booking horizon
 * using the weekly opening hours. Non-exception days are always refreshed
 * from the schedule so future weeks open automatically. Manual exceptions
 * (closed / custom hours) are preserved.
 *
 * Public booking reads via resolvePublicAvailability and does not depend on
 * these rows alone; Admin calendar sync uses this to materialize the same window.
 */
export function ensureFutureAvailability(
  availability: EyeExamAvailability[],
  settings: StoreSettings,
  _opts?: { forceRefreshDefaults?: boolean },
): EyeExamAvailability[] {
  const today = todayInJerusalem();
  const maxDate = publicBookingMaxDate(today);
  const byDate = new Map(availability.map((d) => [d.date, d]));
  const now = new Date().toISOString();
  const next: EyeExamAvailability[] = [];

  for (let date = today; date <= maxDate; date = addDaysIso(date, 1)) {
    const existing = byDate.get(date);
    byDate.delete(date);

    const resolved = resolveAvailabilityDay(existing, settings, date, now);
    if (resolved) {
      next.push(resolved);
      continue;
    }

    // Keep explicit closed exceptions even when weekly schedule says closed
    if (existing?.isException && !existing.isOpen) {
      next.push(existing);
    }
  }

  // Preserve past / out-of-range days (and leftover exceptions)
  for (const day of byDate.values()) {
    next.push(day);
  }

  return next.sort((a, b) => a.date.localeCompare(b.date));
}
