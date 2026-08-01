import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/helpers";
import { getStore } from "@/lib/db/store";
import {
  daySupportsService,
  formatEyeExamDateDisplay,
  isClinicAppointmentType,
  listBookableTimes,
  normalizeAppointmentType,
  todayInJerusalem,
  weekdayUtc,
} from "@/lib/eye-exam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const appointmentType = isClinicAppointmentType(typeParam)
      ? typeParam
      : normalizeAppointmentType(typeParam);

    const { data } = await getStore();
    const today = todayInJerusalem();
    const leadDays = data.settings.bookingLeadDays || 45;
    const maxDate = (() => {
      const [y, m, d] = today.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + leadDays));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    })();

    const openDays = data.eyeExamAvailability
      .filter((day) => day.isOpen && day.date >= today && day.date <= maxDate)
      .filter((day) => daySupportsService(day, appointmentType))
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const day of openDays) {
      const times = listBookableTimes(day, data.eyeExamAppointments, {
        appointmentType,
      });
      if (times.length === 0) continue;
      const time = times[0];
      return NextResponse.json({
        available: true,
        date: day.date,
        time,
        label: formatEyeExamDateDisplay(day.date),
        weekday: weekdayUtc(day.date),
        displayDate: formatEyeExamDateDisplay(day.date).slice(0, 5), // DD/MM
        appointmentType,
      });
    }

    return NextResponse.json({ available: false, appointmentType });
  } catch (error) {
    return handleRouteError(error);
  }
}
