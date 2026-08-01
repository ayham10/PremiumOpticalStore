import { newId } from "@/lib/auth";
import type {
  EyeExamAppointment,
  EyeExamAvailability,
  EyeExamTimeSlot,
} from "@/lib/types";

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
  excludeId?: string
): boolean {
  return appointments.some(
    (a) =>
      a.id !== excludeId &&
      a.appointmentDate === date &&
      a.appointmentTime === time &&
      isActiveEyeExamBooking(a.status)
  );
}

export function getOpenAvailabilityForDate(
  days: EyeExamAvailability[],
  date: string
): EyeExamAvailability | undefined {
  return days.find((day) => day.date === date && day.isOpen);
}

export function listBookableTimes(
  day: EyeExamAvailability,
  appointments: EyeExamAppointment[],
  opts?: { includePastToday?: boolean; now?: Date }
): string[] {
  const today = todayInJerusalem(opts?.now);
  const currentTime = nowTimeInJerusalem(opts?.now);

  return day.slots
    .filter((slot) => slot.isEnabled)
    .filter((slot) => !hasEyeExamSlotConflict(appointments, day.date, slot.time))
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
  time: string
): string {
  if (language === "ar") {
    return `تم تأكيد موعد فحص النظر بتاريخ ${dateDisplay} الساعة ${time}. لومينا للبصريات.`;
  }
  if (language === "he") {
    return `בדיקת העיניים שלך אושרה לתאריך ${dateDisplay} בשעה ${time}. לומינה אופטיקה.`;
  }
  return `Your eye exam is confirmed for ${dateDisplay} at ${time}. Lumina Optical.`;
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
