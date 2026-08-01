import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import { getStore, updateStore } from "@/lib/db/store";
import {
  buildDefaultSlots,
  formatEyeExamDateDisplay,
  hasEyeExamSlotConflict,
  isValidIsoDate,
  parseTimeToMinutes,
  todayInJerusalem,
} from "@/lib/eye-exam";
import type { EyeExamAvailability, EyeExamTimeSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

function enrichDay(day: EyeExamAvailability, bookedTimes: Set<string>) {
  return {
    ...day,
    label: formatEyeExamDateDisplay(day.date),
    slots: day.slots
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((slot) => ({
        ...slot,
        isBooked: bookedTimes.has(`${day.date}|${slot.time}`),
      })),
  };
}

export async function GET() {
  try {
    await requireSession("appointments");
    const { data } = await getStore();
    const booked = new Set(
      data.eyeExamAppointments
        .filter((a) => a.status !== "cancelled")
        .map((a) => `${a.appointmentDate}|${a.appointmentTime}`)
    );

    const days = [...data.eyeExamAvailability]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => enrichDay(day, booked));

    return NextResponse.json({
      days,
      slotMinutes: data.settings.appointmentSlotMinutes || 30,
      defaultSlotTimes: buildDefaultSlots(
        data.settings.appointmentSlotMinutes || 30
      ).map((s) => s.time),
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
      let slots: EyeExamTimeSlot[] = buildDefaultSlots(interval);

      if (body.copyFromDate && isValidIsoDate(body.copyFromDate)) {
        const source = store.eyeExamAvailability.find(
          (d) => d.date === body.copyFromDate
        );
        if (source) {
          slots = source.slots.map((slot) => ({
            id: newId("slot"),
            time: slot.time,
            isEnabled: slot.isEnabled,
          }));
        }
      } else if (Array.isArray(body.times) && body.times.length) {
        const enabled = new Set(
          (body.enabledTimes || body.times).filter(
            (t) => parseTimeToMinutes(t) != null
          )
        );
        slots = body.times
          .filter((t) => parseTimeToMinutes(t) != null)
          .map((time) => ({
            id: newId("slot"),
            time,
            isEnabled: enabled.has(time),
          }));
      }

      created = {
        id: newId("exa"),
        date,
        isOpen: body.isOpen !== false,
        slots,
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
      addTimes?: string[];
      removeTimes?: string[];
      toggleTime?: { time: string; isEnabled: boolean };
    };

    const id = body.id?.trim();
    if (!id) return jsonError("Availability id is required", 400);

    let updated: EyeExamAvailability | null = null;

    await updateStore(async (store) => {
      const index = store.eyeExamAvailability.findIndex((d) => d.id === id);
      if (index < 0) throw new Error("NOT_FOUND");

      const current = store.eyeExamAvailability[index];
      let slots = current.slots.map((s) => ({ ...s }));

      if (Array.isArray(body.slots)) {
        slots = body.slots
          .filter((s) => parseTimeToMinutes(s.time) != null)
          .map((s) => ({
            id: s.id || newId("slot"),
            time: s.time,
            isEnabled: Boolean(s.isEnabled),
          }));
      }

      if (Array.isArray(body.addTimes)) {
        for (const time of body.addTimes) {
          if (parseTimeToMinutes(time) == null) continue;
          if (slots.some((s) => s.time === time)) continue;
          slots.push({ id: newId("slot"), time, isEnabled: true });
        }
      }

      if (Array.isArray(body.removeTimes)) {
        const remove = new Set(body.removeTimes);
        slots = slots.filter((s) => {
          if (!remove.has(s.time)) return true;
          return hasEyeExamSlotConflict(
            store.eyeExamAppointments,
            current.date,
            s.time
          );
        });
        // If booked, keep but disable instead of removing
        for (const time of body.removeTimes) {
          const slot = slots.find((s) => s.time === time);
          if (slot) slot.isEnabled = false;
        }
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
      }

      slots.sort((a, b) => a.time.localeCompare(b.time));

      updated = {
        ...current,
        isOpen: typeof body.isOpen === "boolean" ? body.isOpen : current.isOpen,
        slots,
        updatedAt: new Date().toISOString(),
      };
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
        (a) => a.appointmentDate === day.date && a.status !== "cancelled"
      );
      if (hasBookings) throw new Error("HAS_BOOKINGS");

      store.eyeExamAvailability.splice(index, 1);
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
          409
        );
      }
    }
    return handleRouteError(error);
  }
}
