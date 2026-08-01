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

    const dates = data.eyeExamAvailability
      .filter((day) => day.isOpen && day.date >= today && day.date <= maxDate)
      .filter((day) => daySupportsService(day, appointmentType))
      .filter(
        (day) =>
          listBookableTimes(day, data.eyeExamAppointments, {
            appointmentType,
          }).length > 0,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        label: formatEyeExamDateDisplay(day.date),
      }));

    return NextResponse.json({ dates, appointmentType });
  } catch (error) {
    return handleRouteError(error);
  }
}
