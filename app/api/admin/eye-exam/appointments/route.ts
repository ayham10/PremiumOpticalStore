import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import {
  loadClinicAppointments,
  patchClinicAppointment,
} from "@/lib/db/clinic-appointments";
import { getStore, updateStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  hasEyeExamSlotConflict,
  isClinicAppointmentType,
  isValidEmail,
  isValidIsoDate,
  normalizeAppointmentType,
  normalizeIsraeliPhone,
  parseTimeToMinutes,
  sanitizeName,
} from "@/lib/eye-exam";
import type {
  ClinicAppointmentType,
  EyeExamAppointmentStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES = new Set<EyeExamAppointmentStatus>([
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
]);

export async function GET(request: Request) {
  try {
    await requireSession("appointments");
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const date = searchParams.get("date")?.trim();
    const type = searchParams.get("type")?.trim();
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    let items = await loadClinicAppointments();

    if (status && STATUSES.has(status as EyeExamAppointmentStatus)) {
      items = items.filter((a) => a.status === status);
    }
    if (date) {
      items = items.filter((a) => a.appointmentDate === date);
    }
    if (type && isClinicAppointmentType(type)) {
      items = items.filter(
        (a) => normalizeAppointmentType(a.appointmentType) === type,
      );
    }
    if (q) {
      items = items.filter((a) =>
        [
          a.firstName,
          a.lastName,
          `${a.firstName} ${a.lastName}`,
          a.email,
          a.phone,
          a.id,
          a.appointmentType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    items.sort((a, b) => {
      const byDate = b.appointmentDate.localeCompare(a.appointmentDate);
      if (byDate !== 0) return byDate;
      return b.appointmentTime.localeCompare(a.appointmentTime);
    });

    return NextResponse.json({
      appointments: items.map((a) => ({
        ...a,
        appointmentType: normalizeAppointmentType(a.appointmentType),
        dateLabel: formatEyeExamDateDisplay(a.appointmentDate),
        fullName: `${a.firstName} ${a.lastName}`.trim(),
      })),
      source: "public.appointments",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as {
      id?: string;
      status?: EyeExamAppointmentStatus;
      appointmentDate?: string;
      appointmentTime?: string;
      appointmentType?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };

    const id = body.id?.trim();
    if (!id) return jsonError("Appointment id is required", 400);

    const existing = await loadClinicAppointments();
    const current = existing.find((a) => a.id === id);
    if (!current) return jsonError("Appointment not found", 404);

    const nextStatus =
      body.status && STATUSES.has(body.status) ? body.status : current.status;

    const nextType: ClinicAppointmentType = isClinicAppointmentType(
      body.appointmentType,
    )
      ? body.appointmentType
      : normalizeAppointmentType(current.appointmentType);

    const nextDate = (body.appointmentDate || current.appointmentDate).trim();
    const nextTime = (body.appointmentTime || current.appointmentTime).trim();

    if (!isValidIsoDate(nextDate)) {
      return jsonError("Invalid appointment date", 400);
    }
    if (parseTimeToMinutes(nextTime) == null) {
      return jsonError("Invalid appointment time", 400);
    }

    const firstName =
      body.firstName !== undefined
        ? sanitizeName(body.firstName)
        : current.firstName;
    const lastName =
      body.lastName !== undefined
        ? sanitizeName(body.lastName)
        : current.lastName;
    const email =
      body.email !== undefined
        ? body.email.trim().toLowerCase()
        : current.email;
    let phone = current.phone;
    if (body.phone !== undefined) {
      const normalized = normalizeIsraeliPhone(body.phone.trim());
      if (!normalized) return jsonError("Invalid phone number", 400);
      phone = normalized;
    }

    if (!firstName || !lastName) {
      return jsonError("First and last name are required", 400);
    }
    if (!email || !isValidEmail(email)) {
      return jsonError("Invalid email address", 400);
    }

    const scheduleChanged =
      nextDate !== current.appointmentDate ||
      nextTime !== current.appointmentTime ||
      nextType !== normalizeAppointmentType(current.appointmentType);

    if (scheduleChanged && nextStatus !== "cancelled") {
      const { data: store } = await getStore();
      const day = getOpenAvailabilityForDate(
        store.eyeExamAvailability,
        nextDate,
        nextType,
      );
      if (!day) {
        return jsonError("Selected date is not available for this service", 409);
      }
      const slot = day.slots.find((s) => s.time === nextTime && s.isEnabled);
      if (!slot) return jsonError("Selected time is not available", 409);
      if (
        hasEyeExamSlotConflict(existing, nextDate, nextTime, id, {
          appointmentType: nextType,
          day,
        })
      ) {
        return jsonError("That time slot is already booked", 409);
      }
    }

    const updated = await patchClinicAppointment(id, {
      firstName,
      lastName,
      email,
      phone,
      appointmentDate: nextDate,
      appointmentTime: nextTime,
      appointmentType: nextType,
      status: nextStatus,
    });

    await updateStore(async (store) => {
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "appointment",
        entityId: id,
        detail: scheduleChanged
          ? `reschedule ${nextDate} ${nextTime} type=${nextType} status=${nextStatus}`
          : `status=${nextStatus}`,
      });
      return store;
    });

    return NextResponse.json({
      appointment: {
        ...updated,
        appointmentType: normalizeAppointmentType(updated.appointmentType),
        dateLabel: formatEyeExamDateDisplay(updated.appointmentDate),
        fullName: `${updated.firstName} ${updated.lastName}`.trim(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Appointment not found", 404);
    }
    return handleRouteError(error);
  }
}
