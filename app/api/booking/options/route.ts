import { NextResponse } from "next/server";
import { dayLabel } from "@/lib/appointments";
import { getStore } from "@/lib/db/store";
import { SERVICES } from "@/lib/seed";
import { handleRouteError } from "@/lib/api/helpers";
import { formatDayHoursSummary } from "@/lib/working-hours";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data } = await getStore();

    const staff = data.staff
      .filter((s) => s.active)
      .map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        specialties: s.specialties,
        color: s.color,
        bio: s.bio,
        image: s.image,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const openingHours = data.settings.openingHours.map((h) => ({
      day: h.day,
      label: dayLabel(h.day),
      open: h.open,
      close: h.close,
      closed: Boolean(h.closed),
      summary: h.closed ? "Closed" : formatDayHoursSummary(h) || `${h.open} – ${h.close}`,
    }));

    return NextResponse.json({
      services: SERVICES.map((s) => ({
        key: s.key,
        title: s.title,
        description: s.description,
        image: s.image,
      })),
      staff,
      appointmentSlotMinutes: data.settings.appointmentSlotMinutes,
      bookingLeadDays: data.settings.bookingLeadDays,
      openingHours,
      storeName: data.settings.storeName,
      phone: data.settings.phone,
      whatsapp: data.settings.whatsapp,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
