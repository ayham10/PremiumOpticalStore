import { NextResponse } from "next/server";
import { generateSlots } from "@/lib/appointments";
import { getStore } from "@/lib/db/store";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import type { ServiceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const SERVICE_KEYS: ServiceType[] = [
  "Eye Examination",
  "Prescription Glasses",
  "Sunglasses Fitting",
  "Contact Lenses",
  "Eyeglass Frames",
  "Vision Consultation",
  "Lens Fitting",
];

function isServiceType(value: string): value is ServiceType {
  return (SERVICE_KEYS as string[]).includes(value);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId")?.trim();
    const date = searchParams.get("date")?.trim();
    const serviceParam = searchParams.get("service")?.trim() || null;

    if (!staffId || !date) {
      return jsonError("staffId and date are required", 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("date must be YYYY-MM-DD", 400);
    }

    const { data } = await getStore();
    const staff = data.staff.find((s) => s.id === staffId && s.active);
    if (!staff) {
      return jsonError("Staff member not found", 404);
    }

    let service: ServiceType | null = null;
    if (serviceParam) {
      if (!isServiceType(serviceParam)) {
        return jsonError("Invalid service", 400);
      }
      service = serviceParam;
      if (staff.specialties.length && !staff.specialties.includes(service)) {
        return NextResponse.json({
          slots: [],
          staffId,
          date,
          service,
          message: "Staff member does not offer this service",
        });
      }
    }

    const availability = data.availability.find((a) => a.staffId === staffId);
    const slots = generateSlots({
      date,
      settings: data.settings,
      holidays: data.holidays,
      availability,
      appointments: data.appointments,
      staffId,
    });

    // Respect booking lead window
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${date}T12:00:00`);
    const leadDays = data.settings.bookingLeadDays || 45;
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + leadDays);

    if (target < today || target > maxDate) {
      return NextResponse.json({
        slots: [],
        staffId,
        date,
        service: service || null,
        staffName: staff.name,
      });
    }

    return NextResponse.json({
      slots,
      staffId,
      date,
      service: service || null,
      staffName: staff.name,
      slotMinutes: data.settings.appointmentSlotMinutes,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
