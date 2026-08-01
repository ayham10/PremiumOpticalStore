import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
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

    const { data } = await getStore();
    let items = [...data.eyeExamAppointments];

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

    let updated = null as Awaited<
      ReturnType<typeof getStore>
    >["data"]["eyeExamAppointments"][number] | null;

    await updateStore(async (store) => {
      const index = store.eyeExamAppointments.findIndex((a) => a.id === id);
      if (index < 0) throw new Error("NOT_FOUND");

      const current = store.eyeExamAppointments[index];
      const nextStatus =
        body.status && STATUSES.has(body.status) ? body.status : current.status;

      const nextType: ClinicAppointmentType = isClinicAppointmentType(
        body.appointmentType,
      )
        ? body.appointmentType
        : normalizeAppointmentType(current.appointmentType);

      const nextDate = (body.appointmentDate || current.appointmentDate).trim();
      const nextTime = (body.appointmentTime || current.appointmentTime).trim();

      if (!isValidIsoDate(nextDate)) throw new Error("INVALID_DATE");
      if (parseTimeToMinutes(nextTime) == null) throw new Error("INVALID_TIME");

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
        if (!normalized) throw new Error("INVALID_PHONE");
        phone = normalized;
      }

      if (!firstName || !lastName) throw new Error("INVALID_NAME");
      if (!email || !isValidEmail(email)) throw new Error("INVALID_EMAIL");

      const scheduleChanged =
        nextDate !== current.appointmentDate ||
        nextTime !== current.appointmentTime ||
        nextType !== normalizeAppointmentType(current.appointmentType);

      if (scheduleChanged && nextStatus !== "cancelled") {
        const day = getOpenAvailabilityForDate(
          store.eyeExamAvailability,
          nextDate,
          nextType,
        );
        if (!day) throw new Error("DATE_UNAVAILABLE");
        const slot = day.slots.find((s) => s.time === nextTime && s.isEnabled);
        if (!slot) throw new Error("TIME_UNAVAILABLE");
        if (
          hasEyeExamSlotConflict(
            store.eyeExamAppointments,
            nextDate,
            nextTime,
            id,
            { appointmentType: nextType, day },
          )
        ) {
          throw new Error("SLOT_TAKEN");
        }
      }

      updated = {
        ...current,
        firstName,
        lastName,
        email,
        phone,
        appointmentDate: nextDate,
        appointmentTime: nextTime,
        appointmentType: nextType,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      store.eyeExamAppointments[index] = updated;
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "eye_exam_appointment",
        entityId: id,
        detail: scheduleChanged
          ? `reschedule ${nextDate} ${nextTime} type=${nextType} status=${nextStatus}`
          : `status=${nextStatus}`,
      });
      return store;
    });

    return NextResponse.json({
      appointment: {
        ...updated!,
        appointmentType: normalizeAppointmentType(updated!.appointmentType),
        dateLabel: formatEyeExamDateDisplay(updated!.appointmentDate),
        fullName: `${updated!.firstName} ${updated!.lastName}`.trim(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return jsonError("Appointment not found", 404);
      }
      if (error.message === "INVALID_DATE") {
        return jsonError("Invalid appointment date", 400);
      }
      if (error.message === "INVALID_TIME") {
        return jsonError("Invalid appointment time", 400);
      }
      if (error.message === "INVALID_PHONE") {
        return jsonError("Invalid phone number", 400);
      }
      if (error.message === "INVALID_NAME") {
        return jsonError("First and last name are required", 400);
      }
      if (error.message === "INVALID_EMAIL") {
        return jsonError("Invalid email address", 400);
      }
      if (error.message === "DATE_UNAVAILABLE") {
        return jsonError("Selected date is not available for this service", 409);
      }
      if (error.message === "TIME_UNAVAILABLE") {
        return jsonError("Selected time is not available", 409);
      }
      if (error.message === "SLOT_TAKEN") {
        return jsonError("That time slot is already booked", 409);
      }
    }
    return handleRouteError(error);
  }
}
