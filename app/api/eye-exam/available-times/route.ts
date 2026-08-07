import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import { getStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  isClinicAppointmentType,
  isValidIsoDate,
  listBookableTimes,
  normalizeAppointmentType,
  resolvePublicAvailability,
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
    if (date < today) {
      return NextResponse.json({
        date,
        label: formatEyeExamDateDisplay(date),
        times: [],
        appointmentType,
      });
    }

    const { data } = await getStore();
    const availability = resolvePublicAvailability(
      data.eyeExamAvailability,
      data.settings,
    );
    const day = getOpenAvailabilityForDate(
      availability,
      date,
      appointmentType,
    );
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
