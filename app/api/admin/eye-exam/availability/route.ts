import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import { getStore, updateStore } from "@/lib/db/store";
import {
  buildDefaultSlots,
  buildSlotsFromPeriods,
  CLINIC_APPOINTMENT_TYPES,
  ensureFutureAvailability,
  formatEyeExamDateDisplay,
  hasEyeExamSlotConflict,
  inferPeriodsFromSlots,
  isClinicAppointmentType,
  isValidIsoDate,
  parseTimeToMinutes,
  periodsForDay,
  publicBookingMaxDate,
  todayInJerusalem,
} from "@/lib/eye-exam";
import type {
  ClinicAppointmentType,
  EyeExamAvailability,
  EyeExamTimeSlot,
  WorkingPeriod,
} from "@/lib/types";

function normalizeServices(
  input?: string[] | null,
): ClinicAppointmentType[] | undefined {
  if (!input) return undefined;
  const services = input.filter(isClinicAppointmentType);
  if (services.length === 0) return undefined;
  if (CLINIC_APPOINTMENT_TYPES.every((type) => services.includes(type))) {
    return undefined;
  }
  return Array.from(new Set(services));
}

function normalizePeriods(
  input?: Array<Partial<WorkingPeriod>> | null,
): WorkingPeriod[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input
    .map((p) => {
      const start = String(p.start || "").trim();
      const end = String(p.end || "").trim();
      if (parseTimeToMinutes(start) == null || parseTimeToMinutes(end) == null) {
        return null;
      }
      return {
        id: p.id || newId("period"),
        start,
        end,
        enabled: p.enabled !== false,
      } satisfies WorkingPeriod;
    })
    .filter(Boolean) as WorkingPeriod[];
}

export const dynamic = "force-dynamic";

function enrichDay(
  day: EyeExamAvailability,
  bookedByKey: Map<string, { name: string; id: string }>,
) {
  const periods = periodsForDay(day);
  return {
    ...day,
    label: formatEyeExamDateDisplay(day.date),
    periods,
    slots: day.slots
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((slot) => {
        const booked = bookedByKey.get(`${day.date}|${slot.time}`);
        return {
          ...slot,
          isBooked: Boolean(booked),
          bookedBy: booked?.name,
          bookedId: booked?.id,
        };
      }),
  };
}

export async function GET() {
  try {
    await requireSession("appointments");

    await updateStore((store) => {
      store.eyeExamAvailability = ensureFutureAvailability(
        store.eyeExamAvailability,
        store.settings,
        { forceRefreshDefaults: true },
      );
      return store;
    });

    const { data } = await getStore();
    const bookedByKey = new Map<string, { name: string; id: string }>();
    for (const a of data.eyeExamAppointments) {
      if (a.status === "cancelled") continue;
      const key = `${a.appointmentDate}|${a.appointmentTime}`;
      if (!bookedByKey.has(key)) {
        bookedByKey.set(key, {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`.trim(),
        });
      }
    }

    const today = todayInJerusalem();
    const maxDate = publicBookingMaxDate(today);
    const days = [...data.eyeExamAvailability]
      .filter((d) => d.date >= today && d.date <= maxDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => enrichDay(day, bookedByKey));

    return NextResponse.json({
      days,
      slotMinutes: data.settings.appointmentSlotMinutes || 30,
      openingHours: data.settings.openingHours,
      defaultSlotTimes: buildDefaultSlots(
        data.settings.appointmentSlotMinutes || 30,
      ).map((s) => s.time),
      maxDate,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as {
      date?: string;
      isOpen?: boolean;
      times?: string[];
      copyFromDate?: string;
      enabledTimes?: string[];
      services?: string[];
      periods?: Array<Partial<WorkingPeriod>>;
      isException?: boolean;
    };

    const date = body.date?.trim() || "";
    if (!isValidIsoDate(date)) return jsonError("Invalid date", 400);
    if (date < todayInJerusalem()) {
      return jsonError("Cannot create availability in the past", 400);
    }

    let created: EyeExamAvailability | null = null;

    await updateStore(async (store) => {
      if (store.eyeExamAvailability.some((d) => d.date === date)) {
        throw new Error("DATE_EXISTS");
      }

      const now = new Date().toISOString();
      const interval = store.settings.appointmentSlotMinutes || 30;
      let periods = normalizePeriods(body.periods);
      let slots: EyeExamTimeSlot[] = [];

      if (body.copyFromDate && isValidIsoDate(body.copyFromDate)) {
        const source = store.eyeExamAvailability.find(
          (d) => d.date === body.copyFromDate,
        );
        if (source) {
          periods = periodsForDay(source).map((p) => ({
            ...p,
            id: newId("period"),
          }));
          slots = buildSlotsFromPeriods(periods, interval);
        }
      } else if (periods?.length) {
        slots = buildSlotsFromPeriods(periods, interval);
      } else if (Array.isArray(body.times) && body.times.length) {
        const enabled = new Set(
          (body.enabledTimes || body.times).filter(
            (t) => parseTimeToMinutes(t) != null,
          ),
        );
        slots = body.times
          .filter((t) => parseTimeToMinutes(t) != null)
          .map((time) => ({
            id: newId("slot"),
            time,
            isEnabled: enabled.has(time),
          }));
        periods = inferPeriodsFromSlots(slots);
      } else {
        slots = buildDefaultSlots(interval);
        periods = inferPeriodsFromSlots(slots);
      }

      const services = normalizeServices(body.services);
      created = {
        id: newId("exa"),
        date,
        isOpen: body.isOpen !== false,
        slots,
        periods,
        isException: body.isException !== false,
        ...(services ? { services } : {}),
        createdAt: now,
        updatedAt: now,
      };

      store.eyeExamAvailability.push(created);
      store.eyeExamAvailability.sort((a, b) => a.date.localeCompare(b.date));

      pushActivity(store, {
        actor: session.email,
        action: "create",
        entity: "eye_exam_availability",
        entityId: created.id,
        detail: `date=${date}`,
      });

      return store;
    });

    return NextResponse.json({ day: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DATE_EXISTS") {
      return jsonError("Availability for this date already exists", 409);
    }
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession("appointments");
    const body = (await request.json()) as {
      id?: string;
      isOpen?: boolean;
      slots?: Array<{ id?: string; time: string; isEnabled: boolean }>;
      periods?: Array<Partial<WorkingPeriod>>;
      addTimes?: string[];
      removeTimes?: string[];
      toggleTime?: { time: string; isEnabled: boolean };
      services?: string[] | null;
      isException?: boolean;
      copyFromDate?: string;
    };

    const id = body.id?.trim();
    if (!id) return jsonError("Availability id is required", 400);

    let updated: EyeExamAvailability | null = null;

    await updateStore(async (store) => {
      const index = store.eyeExamAvailability.findIndex((d) => d.id === id);
      if (index < 0) throw new Error("NOT_FOUND");

      const current = store.eyeExamAvailability[index];
      const interval = store.settings.appointmentSlotMinutes || 30;
      let slots = current.slots.map((s) => ({ ...s }));
      let periods = current.periods ? current.periods.map((p) => ({ ...p })) : undefined;
      let markException = Boolean(current.isException);

      if (body.copyFromDate && isValidIsoDate(body.copyFromDate)) {
        const source = store.eyeExamAvailability.find(
          (d) => d.date === body.copyFromDate,
        );
        if (source) {
          periods = periodsForDay(source).map((p) => ({
            ...p,
            id: newId("period"),
          }));
          slots = buildSlotsFromPeriods(periods, interval);
          markException = true;
        }
      }

      const normalizedPeriods = normalizePeriods(body.periods);
      if (normalizedPeriods) {
        periods = normalizedPeriods;
        slots = buildSlotsFromPeriods(periods, interval);
        markException = true;
      }

      if (Array.isArray(body.slots)) {
        slots = body.slots
          .filter((s) => parseTimeToMinutes(s.time) != null)
          .map((s) => ({
            id: s.id || newId("slot"),
            time: s.time,
            isEnabled: Boolean(s.isEnabled),
          }));
        periods = inferPeriodsFromSlots(slots);
        markException = true;
      }

      if (Array.isArray(body.addTimes)) {
        for (const time of body.addTimes) {
          if (parseTimeToMinutes(time) == null) continue;
          if (slots.some((s) => s.time === time)) continue;
          slots.push({ id: newId("slot"), time, isEnabled: true });
        }
        periods = inferPeriodsFromSlots(slots);
        markException = true;
      }

      if (Array.isArray(body.removeTimes)) {
        for (const time of body.removeTimes) {
          const slot = slots.find((s) => s.time === time);
          if (!slot) continue;
          if (
            hasEyeExamSlotConflict(
              store.eyeExamAppointments,
              current.date,
              time,
            )
          ) {
            slot.isEnabled = false;
          } else {
            slots = slots.filter((s) => s.time !== time);
          }
        }
        periods = inferPeriodsFromSlots(slots);
        markException = true;
      }

      if (body.toggleTime?.time) {
        const slot = slots.find((s) => s.time === body.toggleTime!.time);
        if (slot) slot.isEnabled = Boolean(body.toggleTime.isEnabled);
        else if (parseTimeToMinutes(body.toggleTime.time) != null) {
          slots.push({
            id: newId("slot"),
            time: body.toggleTime.time,
            isEnabled: Boolean(body.toggleTime.isEnabled),
          });
        }
        periods = inferPeriodsFromSlots(slots);
        markException = true;
      }

      if (typeof body.isOpen === "boolean") {
        markException = true;
      }

      if (typeof body.isException === "boolean") {
        markException = body.isException;
      }

      slots.sort((a, b) => a.time.localeCompare(b.time));

      const nextServices =
        body.services === null
          ? undefined
          : Array.isArray(body.services)
            ? normalizeServices(body.services)
            : current.services;

      updated = {
        ...current,
        isOpen: typeof body.isOpen === "boolean" ? body.isOpen : current.isOpen,
        slots,
        periods: periods || inferPeriodsFromSlots(slots),
        isException: markException,
        services: nextServices,
        updatedAt: new Date().toISOString(),
      };
      if (!updated.services) delete updated.services;
      store.eyeExamAvailability[index] = updated;

      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "eye_exam_availability",
        entityId: updated.id,
        detail: `date=${updated.date} open=${updated.isOpen}`,
      });

      return store;
    });

    return NextResponse.json({ day: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Availability not found", 404);
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession("appointments");
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id")?.trim();
    if (!id) {
      try {
        const body = (await request.json()) as { id?: string };
        id = body.id?.trim();
      } catch {
        /* no body */
      }
    }
    if (!id) return jsonError("Availability id is required", 400);

    await updateStore(async (store) => {
      const index = store.eyeExamAvailability.findIndex((d) => d.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      const day = store.eyeExamAvailability[index];
      const hasBookings = store.eyeExamAppointments.some(
        (a) => a.appointmentDate === day.date && a.status !== "cancelled",
      );
      if (hasBookings) throw new Error("HAS_BOOKINGS");

      // Soft-delete: close & mark exception instead of removing auto days
      store.eyeExamAvailability[index] = {
        ...day,
        isOpen: false,
        isException: true,
        updatedAt: new Date().toISOString(),
      };
      pushActivity(store, {
        actor: session.email,
        action: "delete",
        entity: "eye_exam_availability",
        entityId: id,
        detail: `date=${day.date}`,
      });
      return store;
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return jsonError("Availability not found", 404);
      }
      if (error.message === "HAS_BOOKINGS") {
        return jsonError(
          "Cannot delete a date that has active bookings. Disable it instead.",
          409,
        );
      }
    }
    return handleRouteError(error);
  }
}
