import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import { getStore, updateStore } from "@/lib/db/store";
import { formatEyeExamDateDisplay } from "@/lib/eye-exam";
import type { EyeExamAppointmentStatus } from "@/lib/types";

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
    const q = searchParams.get("q")?.trim().toLowerCase() || "";

    const { data } = await getStore();
    let items = [...data.eyeExamAppointments];

    if (status && STATUSES.has(status as EyeExamAppointmentStatus)) {
      items = items.filter((a) => a.status === status);
    }
    if (date) {
      items = items.filter((a) => a.appointmentDate === date);
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
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
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
    };

    const id = body.id?.trim();
    if (!id) return jsonError("Appointment id is required", 400);
    if (!body.status || !STATUSES.has(body.status)) {
      return jsonError("Invalid status", 400);
    }

    let updated = null as Awaited<
      ReturnType<typeof getStore>
    >["data"]["eyeExamAppointments"][number] | null;

    await updateStore(async (store) => {
      const index = store.eyeExamAppointments.findIndex((a) => a.id === id);
      if (index < 0) throw new Error("NOT_FOUND");
      updated = {
        ...store.eyeExamAppointments[index],
        status: body.status!,
        updatedAt: new Date().toISOString(),
      };
      store.eyeExamAppointments[index] = updated;
      pushActivity(store, {
        actor: session.email,
        action: "update",
        entity: "eye_exam_appointment",
        entityId: id,
        detail: `status=${body.status}`,
      });
      return store;
    });

    return NextResponse.json({
      appointment: {
        ...updated!,
        dateLabel: formatEyeExamDateDisplay(updated!.appointmentDate),
        fullName: `${updated!.firstName} ${updated!.lastName}`.trim(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return jsonError("Appointment not found", 404);
    }
    return handleRouteError(error);
  }
}
