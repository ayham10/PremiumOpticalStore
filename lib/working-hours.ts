import { overlaps, parseTimeToMinutes } from "@/lib/appointments";
import type { DayHoursPeriod, WorkingHours } from "@/lib/types";

export const MAX_DAY_PERIODS = 3;

export function getDayPeriods(hours: WorkingHours): DayHoursPeriod[] {
  if (hours.periods?.length) {
    return hours.periods.map((p) => ({ open: p.open, close: p.close }));
  }
  if (hours.closed) return [];
  return [{ open: hours.open, close: hours.close }];
}

export function syncDayHours(hours: WorkingHours): WorkingHours {
  if (hours.closed) {
    return { ...hours, periods: undefined };
  }
  const periods = getDayPeriods(hours);
  if (!periods.length) {
    return {
      ...hours,
      open: hours.open || "09:00",
      close: hours.close || "18:00",
      periods: [{ open: hours.open || "09:00", close: hours.close || "18:00" }],
    };
  }
  return {
    ...hours,
    periods,
    open: periods[0].open,
    close: periods[periods.length - 1].close,
  };
}

export function normalizeOpeningHours(hours: WorkingHours[]): WorkingHours[] {
  return hours.map((row) => syncDayHours(row));
}

export type DayPeriodValidationCode =
  | "invalidRange"
  | "overlap"
  | "maxPeriods";

export function validateDayPeriods(
  periods: DayHoursPeriod[],
): DayPeriodValidationCode | null {
  if (periods.length > MAX_DAY_PERIODS) return "maxPeriods";

  const sorted = periods
    .map((p) => ({
      open: p.open,
      close: p.close,
      openMin: parseTimeToMinutes(p.open),
      closeMin: parseTimeToMinutes(p.close),
    }))
    .sort((a, b) => a.openMin - b.openMin);

  for (const p of sorted) {
    if (!Number.isFinite(p.openMin) || !Number.isFinite(p.closeMin)) {
      return "invalidRange";
    }
    if (p.closeMin <= p.openMin) return "invalidRange";
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (overlaps(prev.open, prev.close, cur.open, cur.close)) {
      return "overlap";
    }
  }

  return null;
}

export function formatDayHoursSummary(hours: WorkingHours): string {
  if (hours.closed) return "";
  return getDayPeriods(hours)
    .map((p) => `${p.open} – ${p.close}`)
    .join(", ");
}
