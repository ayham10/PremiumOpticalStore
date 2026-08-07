import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import { getStore, invalidateStoreCache } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  isClinicAppointmentType,
  isValidIsoDate,
  listBookableTimes,
  normalizeAppointmentType,
  publicBookingMaxDate,
  resolveAvailabilityDay,
  todayInJerusalem,
} from "@/lib/eye-exam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() || "";
    const typeParam = searchParams.get("type");
    const appointmentType = isClinicAppointmentType(typeParam)
      ? typeParam
      : normalizeAppointmentType(typeParam);

    if (!isValidIsoDate(date)) {
      return jsonError("Invalid date", 400);
    }

    const today = todayInJerusalem();
    const maxDate = publicBookingMaxDate(today);
    if (date < today || date > maxDate) {
      return NextResponse.json({
        date,
        label: formatEyeExamDateDisplay(date),
        times: [],
        appointmentType,
      });
    }

    invalidateStoreCache();
    const { data } = await getStore();
    const existing = data.eyeExamAvailability.find((d) => d.date === date);
    const resolved = resolveAvailabilityDay(existing, data.settings, date);
    const day =
      resolved && resolved.isOpen
        ? getOpenAvailabilityForDate([resolved], date, appointmentType)
        : undefined;
    if (!day) {
      return NextResponse.json({
        date,
        label: formatEyeExamDateDisplay(date),
        times: [],
        appointmentType,
      });
    }

    const times = listBookableTimes(day, data.eyeExamAppointments, {
      appointmentType,
    });
    return NextResponse.json(
      {
        date,
        label: formatEyeExamDateDisplay(date),
        times,
        appointmentType,
      },
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
