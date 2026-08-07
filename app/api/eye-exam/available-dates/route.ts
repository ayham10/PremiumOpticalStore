import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/helpers";
import { getStore, invalidateStoreCache } from "@/lib/db/store";
import {
  daySupportsService,
  formatEyeExamDateDisplay,
  isClinicAppointmentType,
  listBookableTimes,
  normalizeAppointmentType,
  publicBookingMaxDate,
  resolvePublicAvailability,
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

    // Fresh store so Admin Working Hours changes apply immediately
    invalidateStoreCache();
    const { data } = await getStore();
    const availability = resolvePublicAvailability(
      data.eyeExamAvailability,
      data.settings,
    );
    const today = todayInJerusalem();
    const maxDate = publicBookingMaxDate(today);

    const dates = availability
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

    return NextResponse.json(
      { dates, appointmentType, maxDate },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
