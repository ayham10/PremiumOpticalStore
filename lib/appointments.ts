import { addMinutes, format, parse } from "date-fns";
import type {
  Appointment,
  Holiday,
  StaffAvailability,
  StoreSettings,
  WorkingHours,
} from "@/lib/types";

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = parseTimeToMinutes(aStart);
  const ae = parseTimeToMinutes(aEnd);
  const bs = parseTimeToMinutes(bStart);
  const be = parseTimeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function getWorkingHoursForDate(
  date: string,
  hours: WorkingHours[],
  holidays: Holiday[],
  availability?: StaffAvailability
): WorkingHours | null {
  if (holidays.some((h) => h.date === date && h.allDay)) return null;
  if (availability?.unavailableDates.includes(date)) return null;

  const day = new Date(`${date}T12:00:00`).getDay();
  const source = availability?.workingHours?.length
    ? availability.workingHours
    : hours;
  const wh = source.find((w) => w.day === day);
  if (!wh || wh.closed) return null;
  return wh;
}

export function generateSlots(opts: {
  date: string;
  settings: StoreSettings;
  holidays: Holiday[];
  availability?: StaffAvailability;
  appointments: Appointment[];
  staffId: string;
}): string[] {
  const wh = getWorkingHoursForDate(
    opts.date,
    opts.settings.openingHours,
    opts.holidays,
    opts.availability
  );
  if (!wh) return [];

  const slot = opts.settings.appointmentSlotMinutes || 30;
  const open = parseTimeToMinutes(wh.open);
  const close = parseTimeToMinutes(wh.close);
  const slots: string[] = [];

  const occupied = opts.appointments.filter(
    (a) =>
      a.staffId === opts.staffId &&
      a.date === opts.date &&
      a.status !== "cancelled"
  );

  for (let t = open; t + slot <= close; t += slot) {
    const start = minutesToTime(t);
    const end = minutesToTime(t + slot);
    const conflict = occupied.some((a) =>
      overlaps(start, end, a.startTime, a.endTime)
    );
    if (!conflict) slots.push(start);
  }

  // Hide past slots for today
  const today = format(new Date(), "yyyy-MM-dd");
  if (opts.date === today) {
    const nowMinutes =
      new Date().getHours() * 60 + new Date().getMinutes() + 30;
    return slots.filter((s) => parseTimeToMinutes(s) >= nowMinutes);
  }

  return slots;
}

export function endTimeFromStart(start: string, minutes: number): string {
  const base = parse(start, "HH:mm", new Date());
  return format(addMinutes(base, minutes), "HH:mm");
}

export function hasConflict(
  appointments: Appointment[],
  candidate: Pick<Appointment, "staffId" | "date" | "startTime" | "endTime" | "id">
): boolean {
  return appointments.some(
    (a) =>
      a.id !== candidate.id &&
      a.staffId === candidate.staffId &&
      a.date === candidate.date &&
      a.status !== "cancelled" &&
      overlaps(a.startTime, a.endTime, candidate.startTime, candidate.endTime)
  );
}

export function isPromotionActive(
  startDate: string,
  endDate: string,
  active = true
): boolean {
  if (!active) return false;
  const today = format(new Date(), "yyyy-MM-dd");
  return today >= startDate && today <= endDate;
}

export function dayLabel(day: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] || "";
}
