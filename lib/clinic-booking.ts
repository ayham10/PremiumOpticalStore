import type { ClinicAppointmentType } from "@/lib/types";

/** Display YYYY-MM-DD as DD/MM/YY without timezone shifts (client-safe). */
export function formatClinicDateDisplay(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

export const CLINIC_BOOKING_SERVICES: ClinicAppointmentType[] = [
  "eye_exam",
  "contact_lens_fitting",
  "frame_consultation",
  "sunglasses_consultation",
];

/** Map legacy /book?service=… and page deep-links to clinic types */
export function resolveClinicTypeFromQuery(
  type?: string | null,
  service?: string | null,
): ClinicAppointmentType | null {
  const raw = (type || "").trim().toLowerCase();
  if (
    raw === "eye_exam" ||
    raw === "contact_lens_fitting" ||
    raw === "frame_consultation" ||
    raw === "sunglasses_consultation"
  ) {
    return raw;
  }

  const s = (service || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("eye") || s.includes("examination") || s.includes("exam")) {
    return "eye_exam";
  }
  if (s.includes("contact") || s.includes("lens fitting") || s.includes("fitting")) {
    return "contact_lens_fitting";
  }
  if (s.includes("sunglass")) return "sunglasses_consultation";
  if (
    s.includes("frame") ||
    s.includes("vision consultation") ||
    s.includes("consultation") ||
    s.includes("glasses")
  ) {
    return "frame_consultation";
  }
  return null;
}

export function groupTimesOfDay(times: string[]): {
  morning: string[];
  afternoon: string[];
  evening: string[];
} {
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];
  for (const time of times) {
    const hour = Number(time.slice(0, 2));
    if (Number.isNaN(hour)) continue;
    if (hour < 12) morning.push(time);
    else if (hour < 17) afternoon.push(time);
    else evening.push(time);
  }
  return { morning, afternoon, evening };
}

export function buildMonthGrid(year: number, monthIndex: number): Array<{
  iso: string | null;
  day: number | null;
}> {
  // monthIndex 0-11; grid starts on Sunday to match existing weekday labels
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = first.getUTCDay(); // 0 Sun
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: Array<{ iso: string | null; day: number | null }> = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ iso: null, day: null });
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
  return cells;
}
