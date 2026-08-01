import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/helpers";
import { getStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  listBookableTimes,
  todayInJerusalem,
} from "@/lib/eye-exam";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
      .filter(
        (day) =>
          listBookableTimes(day, data.eyeExamAppointments).length > 0
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        date: day.date,
        label: formatEyeExamDateDisplay(day.date),
      }));

    return NextResponse.json({ dates });
  } catch (error) {
    return handleRouteError(error);
  }
}
