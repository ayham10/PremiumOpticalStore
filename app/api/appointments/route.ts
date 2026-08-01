import { NextResponse } from "next/server";
import {
  endTimeFromStart,
  hasConflict,
} from "@/lib/appointments";
import {
  getSession,
  hasPermission,
  newId,
  requireSession,
} from "@/lib/auth";
import {
  listAppointmentsForAdminDashboard,
  loadClinicAppointments,
} from "@/lib/db/clinic-appointments";
import {
  relationalAppointmentsEnabled,
  rowToAppointment,
  updateRelationalAppointment,
} from "@/lib/db/relational-appointments";
import { getStore, updateStore } from "@/lib/db/store";
import {
  appointmentSmsBody,
  sendSms,
  type SmsType,
} from "@/lib/sms/provider";
import {
  handleRouteError,
  jsonError,
  pushActivity,
  pushSmsLog,
} from "@/lib/api/helpers";
import type {
  Appointment,
  AppointmentStatus,
  Customer,
  ServiceType,
} from "@/lib/types";

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

const STATUSES = new Set<AppointmentStatus>([
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "rescheduled",
  "no-show",
]);

function isServiceType(value: string): value is ServiceType {
  return (SERVICE_KEYS as string[]).includes(value);
}

function enrichAppointment(
  appointment: Appointment,
  staffName?: string
) {
  return { ...appointment, staffName: staffName || null };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();
    const status = searchParams.get("status")?.trim();
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const date = searchParams.get("date")?.trim();

    const { data } = await getStore();

    if (token) {
      const appointment = data.appointments.find((a) => a.manageToken === token);
      if (!appointment) return jsonError("Appointment not found", 404);
      const staff = data.staff.find((s) => s.id === appointment.staffId);
      return NextResponse.json({
        appointment: enrichAppointment(appointment, staff?.name),
      });
    }

    await requireSession("appointments");

    let appointments: Appointment[] = [];

    if (relationalAppointmentsEnabled()) {
      try {
        const rows = await listAppointmentsForAdminDashboard();
        appointments = rows.map(rowToAppointment);
      } catch (error) {
        console.error("Relational appointments list failed", error);
      }
    }

    if (!appointments.length) {
      const clinic = await loadClinicAppointments();
      appointments = clinic.map((a) => ({
        id: a.id,
        service: a.appointmentType,
        staffId: "",
        customerId: "",
        customerName: `${a.firstName} ${a.lastName}`.trim(),
        customerEmail: a.email,
        customerPhone: a.phone,
        date: a.appointmentDate,
        startTime: a.appointmentTime,
        endTime: a.appointmentTime,
        status: a.status as AppointmentStatus,
        manageToken: "",
        language: a.language,
        smsStatus: a.smsStatus,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }));
    }

    // Merge any legacy staff JSON appointments not already present
    const seen = new Set(appointments.map((a) => a.id));
    for (const legacy of data.appointments || []) {
      if (!seen.has(legacy.id)) appointments.push(legacy);
    }

    if (status && STATUSES.has(status as AppointmentStatus)) {
      appointments = appointments.filter((a) => a.status === status);
    }

    if (date) {
      appointments = appointments.filter((a) => a.date === date);
    }

    if (q) {
      appointments = appointments.filter((a) =>
        [
          a.customerName,
          a.customerEmail,
          a.customerPhone,
          a.service,
          a.notes,
          a.id,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      );
    }

    appointments.sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      return b.startTime.localeCompare(a.startTime);
    });

    const staffMap = new Map(data.staff.map((s) => [s.id, s.name]));

    return NextResponse.json({
      appointments: appointments.map((a) =>
        enrichAppointment(a, staffMap.get(a.staffId))
      ),
      source: relationalAppointmentsEnabled()
        ? "public.appointments"
        : "document_store",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      service?: string;
      staffId?: string;
      date?: string;
      startTime?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      notes?: string;
      status?: AppointmentStatus;
    };

    const serviceRaw = body.service?.trim();
    const staffId = body.staffId?.trim();
    const date = body.date?.trim();
    const startTime = body.startTime?.trim();
    const customerName = body.customerName?.trim();
    const customerEmail = body.customerEmail?.trim().toLowerCase();
    const customerPhone = body.customerPhone?.trim();
    const notes = body.notes?.trim();

    if (
      !serviceRaw ||
      !isServiceType(serviceRaw) ||
      !staffId ||
      !date ||
      !startTime ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return jsonError("Missing required booking fields", 400);
    }

    const service: ServiceType = serviceRaw;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
      return jsonError("Invalid date or startTime format", 400);
    }

    const session = await getSession();
    const isAdmin = session && hasPermission(session.role, "appointments");
    const requestedStatus = body.status;
    const status: AppointmentStatus =
      isAdmin && requestedStatus && STATUSES.has(requestedStatus)
        ? requestedStatus
        : "pending";

    let created: Appointment | null = null;

    const { data } = await updateStore(async (store) => {
      const staff = store.staff.find((s) => s.id === staffId && s.active);
      if (!staff) throw new Error("STAFF_NOT_FOUND");
      if (staff.specialties.length && !staff.specialties.includes(service)) {
        throw new Error("STAFF_SERVICE");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(`${date}T12:00:00`);
      const leadDays = store.settings.bookingLeadDays || 45;
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + leadDays);
      if (target < today || target > maxDate) {
        throw new Error("DATE_OUT_OF_RANGE");
      }

      const slotMinutes = store.settings.appointmentSlotMinutes || 30;
      const endTime = endTimeFromStart(startTime, slotMinutes);
      const tempId = newId("apt");

      if (
        hasConflict(store.appointments, {
          id: tempId,
          staffId,
          date,
          startTime,
          endTime,
        })
      ) {
        throw new Error("CONFLICT");
      }

      let customer =
        store.customers.find(
          (c) =>
            c.email.toLowerCase() === customerEmail ||
            c.phone.replace(/\D/g, "") === customerPhone.replace(/\D/g, "")
        ) || null;

      const now = new Date().toISOString();
      if (!customer) {
        customer = {
          id: newId("cus"),
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          createdAt: now,
          updatedAt: now,
        } satisfies Customer;
        store.customers.unshift(customer);
      } else {
        customer = {
          ...customer,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          updatedAt: now,
        };
        const idx = store.customers.findIndex((c) => c.id === customer!.id);
        if (idx >= 0) store.customers[idx] = customer;
      }

      created = {
        id: tempId,
        service,
        staffId,
        customerId: customer.id,
        customerName,
        customerEmail,
        customerPhone,
        date,
        startTime,
        endTime,
        status,
        notes: notes || undefined,
        manageToken: newId("tok"),
        createdAt: now,
        updatedAt: now,
      };

      store.appointments.unshift(created);

      const smsBody = appointmentSmsBody("appointment_confirmation", {
        storeName: store.settings.storeName,
        customerName,
        service,
        date,
        time: startTime,
        staffName: staff.name,
      });

      const smsResult = await sendSms({
        to: customerPhone,
        body: smsBody,
        type: "appointment_confirmation",
        appointmentId: created.id,
      });

      pushSmsLog(store, {
        to: customerPhone,
        body: smsBody,
        type: "appointment_confirmation",
        result: smsResult,
        appointmentId: created.id,
      });

      if (isAdmin && session) {
        pushActivity(store, {
          actor: session.email,
          action: "create",
          entity: "appointment",
          entityId: created.id,
          detail: `${customerName} — ${service} on ${date} ${startTime}`,
        });
      } else {
        pushActivity(store, {
          actor: customerEmail,
          action: "public_booking",
          entity: "appointment",
          entityId: created.id,
          detail: `${customerName} — ${service} on ${date} ${startTime}`,
        });
      }

      return store;
    });

    const staff = data.staff.find((s) => s.id === staffId);
    return NextResponse.json(
      {
        appointment: enrichAppointment(
          data.appointments.find((a) => a.id === created!.id)!,
          staff?.name
        ),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "STAFF_NOT_FOUND") {
        return jsonError("Staff member not found", 404);
      }
      if (error.message === "STAFF_SERVICE") {
        return jsonError("Selected staff does not offer this service", 400);
      }
      if (error.message === "DATE_OUT_OF_RANGE") {
        return jsonError("Selected date is outside the booking window", 400);
      }
      if (error.message === "CONFLICT") {
        return jsonError("This time slot is no longer available", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      token?: string;
      status?: AppointmentStatus;
      date?: string;
      startTime?: string;
      staffId?: string;
      notes?: string;
      sendSms?: boolean;
    };

    const session = await getSession();
    const isAdmin = session && hasPermission(session.role, "appointments");

    if (!isAdmin && !body.token) {
      return jsonError("Unauthorized", 401);
    }

    if (!body.id && !body.token) {
      return jsonError("Appointment id or token is required", 400);
    }

    if (body.status && !STATUSES.has(body.status)) {
      return jsonError("Invalid status", 400);
    }

    let updated: Appointment | null = null;
    let smsType: SmsType | null = null;

    // Clinic / relational appointments (public.appointments)
    if (isAdmin && body.id && relationalAppointmentsEnabled()) {
      try {
        const patch: Record<string, string | null> = {};
        if (body.status) patch.status = body.status;
        if (body.date?.trim()) patch.appointment_date = body.date.trim();
        if (body.startTime?.trim()) {
          patch.start_time = body.startTime.trim();
          const { data } = await getStore();
          const mins = data.settings.appointmentSlotMinutes || 30;
          patch.end_time = endTimeFromStart(body.startTime.trim(), mins);
        }
        if (body.notes !== undefined) patch.notes = body.notes.trim() || null;
        if (Object.keys(patch).length) {
          const row = await updateRelationalAppointment(body.id, patch);
          updated = rowToAppointment(row);
          await updateStore(async (store) => {
            pushActivity(store, {
              actor: session!.email,
              action: "update",
              entity: "appointment",
              entityId: updated!.id,
              detail: `status=${updated!.status}`,
            });
            return store;
          });
          return NextResponse.json({
            appointment: enrichAppointment(updated),
            source: "public.appointments",
          });
        }
      } catch (error) {
        // Fall through to legacy JSON path if not found relationally
        const message = error instanceof Error ? error.message : "";
        if (!message.includes("not found") && !message.includes("404")) {
          throw error;
        }
      }
    }

    await updateStore(async (store) => {
      const index = store.appointments.findIndex((a) =>
        body.id ? a.id === body.id : a.manageToken === body.token
      );
      if (index < 0) throw new Error("NOT_FOUND");

      const current = store.appointments[index];

      if (!isAdmin && body.token !== current.manageToken) {
        throw new Error("UNAUTHORIZED");
      }

      // Public manage token can only cancel or reschedule
      if (!isAdmin) {
        if (
          body.status &&
          body.status !== "cancelled" &&
          body.status !== "rescheduled" &&
          body.status !== "pending"
        ) {
          throw new Error("FORBIDDEN");
        }
      }

      const nextDate = body.date?.trim() || current.date;
      const nextStart = body.startTime?.trim() || current.startTime;
      const nextStaffId = body.staffId?.trim() || current.staffId;
      const slotMinutes = store.settings.appointmentSlotMinutes || 30;
      const nextEnd = endTimeFromStart(nextStart, slotMinutes);

      const timeChanged =
        nextDate !== current.date ||
        nextStart !== current.startTime ||
        nextStaffId !== current.staffId;

      if (timeChanged) {
        const staff = store.staff.find((s) => s.id === nextStaffId && s.active);
        if (!staff) throw new Error("STAFF_NOT_FOUND");

        if (
          hasConflict(store.appointments, {
            id: current.id,
            staffId: nextStaffId,
            date: nextDate,
            startTime: nextStart,
            endTime: nextEnd,
          })
        ) {
          throw new Error("CONFLICT");
        }
      }

      let nextStatus = body.status || current.status;
      if (timeChanged && !body.status) {
        nextStatus = isAdmin ? "rescheduled" : "pending";
      }

      updated = {
        ...current,
        date: nextDate,
        startTime: nextStart,
        endTime: nextEnd,
        staffId: nextStaffId,
        status: nextStatus,
        notes:
          body.notes !== undefined
            ? body.notes.trim() || undefined
            : current.notes,
        updatedAt: new Date().toISOString(),
      };

      store.appointments[index] = updated;

      if (nextStatus === "cancelled" && current.status !== "cancelled") {
        smsType = "appointment_cancellation";
      } else if (timeChanged) {
        smsType = "appointment_rescheduled";
      } else if (
        nextStatus === "confirmed" &&
        current.status !== "confirmed"
      ) {
        smsType = "appointment_confirmation";
      }

      const shouldSms = body.sendSms !== false && smsType;

      if (shouldSms && smsType && updated) {
        const staff = store.staff.find((s) => s.id === updated!.staffId);
        const bodyText = appointmentSmsBody(smsType, {
          storeName: store.settings.storeName,
          customerName: updated.customerName,
          service: updated.service,
          date: updated.date,
          time: updated.startTime,
          staffName: staff?.name,
        });
        const result = await sendSms({
          to: updated.customerPhone,
          body: bodyText,
          type: smsType,
          appointmentId: updated.id,
        });
        pushSmsLog(store, {
          to: updated.customerPhone,
          body: bodyText,
          type: smsType,
          result,
          appointmentId: updated.id,
        });
      }

      pushActivity(store, {
        actor: isAdmin && session ? session.email : updated.customerEmail,
        action: "update",
        entity: "appointment",
        entityId: updated.id,
        detail: `status=${updated.status}${timeChanged ? " (rescheduled)" : ""}`,
      });

      return store;
    });

    const { data } = await getStore();
    const staff = data.staff.find((s) => s.id === updated!.staffId);

    return NextResponse.json({
      appointment: enrichAppointment(updated!, staff?.name),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return jsonError("Appointment not found", 404);
      if (error.message === "STAFF_NOT_FOUND") {
        return jsonError("Staff member not found", 404);
      }
      if (error.message === "CONFLICT") {
        return jsonError("This time slot is no longer available", 409);
      }
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id")?.trim();
    let token = searchParams.get("token")?.trim();

    if (!id && !token) {
      try {
        const body = (await request.json()) as { id?: string; token?: string };
        id = body.id?.trim();
        token = body.token?.trim();
      } catch {
        // no body
      }
    }

    const session = await getSession();
    const isAdmin = session && hasPermission(session.role, "appointments");

    if (!isAdmin && !token) {
      return jsonError("Unauthorized", 401);
    }

    if (!id && !token) {
      return jsonError("Appointment id or token is required", 400);
    }

    let cancelled: Appointment | null = null;

    await updateStore(async (store) => {
      const index = store.appointments.findIndex((a) =>
        id ? a.id === id : a.manageToken === token
      );
      if (index < 0) throw new Error("NOT_FOUND");

      const current = store.appointments[index];
      if (!isAdmin && token !== current.manageToken) {
        throw new Error("UNAUTHORIZED");
      }

      cancelled = {
        ...current,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      };
      store.appointments[index] = cancelled;

      const staff = store.staff.find((s) => s.id === cancelled!.staffId);
      const bodyText = appointmentSmsBody("appointment_cancellation", {
        storeName: store.settings.storeName,
        customerName: cancelled.customerName,
        service: cancelled.service,
        date: cancelled.date,
        time: cancelled.startTime,
        staffName: staff?.name,
      });
      const result = await sendSms({
        to: cancelled.customerPhone,
        body: bodyText,
        type: "appointment_cancellation",
        appointmentId: cancelled.id,
      });
      pushSmsLog(store, {
        to: cancelled.customerPhone,
        body: bodyText,
        type: "appointment_cancellation",
        result,
        appointmentId: cancelled.id,
      });

      pushActivity(store, {
        actor: isAdmin && session ? session.email : cancelled.customerEmail,
        action: "cancel",
        entity: "appointment",
        entityId: cancelled.id,
        detail: `${cancelled.customerName} — ${cancelled.date} ${cancelled.startTime}`,
      });

      return store;
    });

    return NextResponse.json({ ok: true, appointment: cancelled });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Appointment not found", 404);
    }
    return handleRouteError(error);
  }
}
