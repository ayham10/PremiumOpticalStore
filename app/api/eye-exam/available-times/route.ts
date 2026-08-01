import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import { getStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  isValidIsoDate,
  listBookableTimes,
  todayInJerusalem,
} from "@/lib/eye-exam";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() || "";

    if (!isValidIsoDate(date)) {
      return jsonError("Invalid date", 400);
    }

    const today = todayInJerusalem();
    if (date < today) {
      return NextResponse.json({
        date,
        label: formatEyeExamDateDisplay(date),
        times: [],
      });
    }

    const { data } = await getStore();
    const day = getOpenAvailabilityForDate(data.eyeExamAvailability, date);
    if (!day) {
      return NextResponse.json({
        date,
        label: formatEyeExamDateDisplay(date),
        times: [],
      });
    }

    const times = listBookableTimes(day, data.eyeExamAppointments);
    return NextResponse.json({
      date,
      label: formatEyeExamDateDisplay(date),
      times,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
