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
    .map((p) => `${p.open}–${p.close}`)
    .join(" / ");
}

function hoursSignature(hours: WorkingHours): string {
  if (hours.closed) return "closed";
  return getDayPeriods(hours)
    .map((p) => `${p.open}-${p.close}`)
    .join("|");
}

export type PublicHoursLine = {
  key: string;
  startDay: number;
  endDay: number;
  label: string;
  value: string;
  closed: boolean;
};

export function formatPeriodsDisplay(
  hours: WorkingHours,
  closedLabel: string,
): string {
  if (hours.closed) return closedLabel;
  const summary = formatDayHoursSummary(hours);
  return summary || closedLabel;
}

export function buildPublicHoursLines(
  hours: WorkingHours[] | undefined,
  dayName: (day: number) => string,
  closedLabel: string,
): PublicHoursLine[] {
  if (!hours?.length) return [];

  const ordered = [...hours].sort((a, b) => a.day - b.day);
  const groups: {
    startDay: number;
    endDay: number;
    closed: boolean;
    value: string;
    signature: string;
  }[] = [];

  for (const row of ordered) {
    const signature = hoursSignature(row);
    const value = formatPeriodsDisplay(row, closedLabel);
    const last = groups[groups.length - 1];
    if (last && last.endDay === row.day - 1 && last.signature === signature) {
      last.endDay = row.day;
      continue;
    }
    groups.push({
      startDay: row.day,
      endDay: row.day,
      closed: Boolean(row.closed),
      value,
      signature,
    });
  }

  return groups.map((group) => ({
    key: `${group.startDay}-${group.endDay}`,
    startDay: group.startDay,
    endDay: group.endDay,
    label:
      group.startDay === group.endDay
        ? dayName(group.startDay)
        : `${dayName(group.startDay)} – ${dayName(group.endDay)}`,
    value: group.value,
    closed: group.closed,
  }));
}
