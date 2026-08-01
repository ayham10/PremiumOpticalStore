import {
  ensureClinicAppointmentsMigrated,
  getRelationalAppointmentById,
  insertRelationalAppointment,
  listClinicAppointmentsAsEyeExam,
  listRelationalAppointments,
  relationalAppointmentsEnabled,
  rowToEyeExamAppointment,
  updateRelationalAppointment,
  eyeExamToInsertRow,
} from "@/lib/db/relational-appointments";
import { getStore } from "@/lib/db/store";
import type { EyeExamAppointment, EyeExamAppointmentStatus } from "@/lib/types";

export { ensureClinicAppointmentsMigrated };

/**
 * Unified clinic appointment access:
 * - Production (Supabase): public.appointments
 * - Local filesystem fallback: lumina_store / store.json eyeExamAppointments
 */
export async function loadClinicAppointments(): Promise<EyeExamAppointment[]> {
  const { data } = await getStore();
  const slotMinutes = data.settings.appointmentSlotMinutes || 30;

  if (relationalAppointmentsEnabled()) {
    await ensureClinicAppointmentsMigrated(
      data.eyeExamAppointments || [],
      slotMinutes,
    );
    return listClinicAppointmentsAsEyeExam();
  }

  return data.eyeExamAppointments || [];
}

export async function createClinicAppointment(
  appointment: EyeExamAppointment,
): Promise<EyeExamAppointment> {
  const { data } = await getStore();
  const slotMinutes = data.settings.appointmentSlotMinutes || 30;

  if (relationalAppointmentsEnabled()) {
    await ensureClinicAppointmentsMigrated(
      data.eyeExamAppointments || [],
      slotMinutes,
    );
    const row = await insertRelationalAppointment(
      eyeExamToInsertRow(appointment, slotMinutes),
    );
    return rowToEyeExamAppointment(row);
  }

  // Filesystem / local fallback — keep JSON behaviour for non-Supabase envs
  const { updateStore } = await import("@/lib/db/store");
  await updateStore(async (store) => {
    store.eyeExamAppointments.unshift(appointment);
    return store;
  });
  return appointment;
}

export async function patchClinicAppointment(
  id: string,
  patch: Partial<EyeExamAppointment> & {
    status?: EyeExamAppointmentStatus | string;
  },
): Promise<EyeExamAppointment> {
  if (relationalAppointmentsEnabled()) {
    const current = await getRelationalAppointmentById(id);
    if (!current) throw new Error("NOT_FOUND");

    const name =
      patch.firstName !== undefined || patch.lastName !== undefined
        ? `${patch.firstName ?? current.customer_name.split(/\s+/)[0] ?? ""} ${
            patch.lastName ??
            current.customer_name.split(/\s+/).slice(1).join(" ")
          }`.trim()
        : undefined;

    const start = patch.appointmentTime;
    const slotMinutes = 30;
    const end =
      start != null
        ? (() => {
            const [h, m] = start.split(":").map(Number);
            const total = h * 60 + m + slotMinutes;
            return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
              total % 60,
            ).padStart(2, "0")}`;
          })()
        : undefined;

    const row = await updateRelationalAppointment(id, {
      ...(name ? { customer_name: name } : {}),
      ...(patch.email !== undefined ? { customer_email: patch.email } : {}),
      ...(patch.phone !== undefined ? { customer_phone: patch.phone } : {}),
      ...(patch.appointmentDate !== undefined
        ? { appointment_date: patch.appointmentDate }
        : {}),
      ...(start !== undefined ? { start_time: start, end_time: end } : {}),
      ...(patch.appointmentType !== undefined
        ? { service: patch.appointmentType }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.language !== undefined ? { language: patch.language } : {}),
      ...(patch.smsStatus !== undefined ? { sms_status: patch.smsStatus } : {}),
      ...(patch.smsError !== undefined
        ? { sms_error: patch.smsError || null }
        : {}),
    });
    return rowToEyeExamAppointment(row);
  }

  const { updateStore } = await import("@/lib/db/store");
  let updated: EyeExamAppointment | null = null;
  await updateStore(async (store) => {
    const index = store.eyeExamAppointments.findIndex((a) => a.id === id);
    if (index < 0) throw new Error("NOT_FOUND");
    updated = {
      ...store.eyeExamAppointments[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    } as EyeExamAppointment;
    store.eyeExamAppointments[index] = updated;
    return store;
  });
  if (!updated) throw new Error("NOT_FOUND");
  return updated;
}

export async function listAppointmentsForAdminDashboard(): Promise<
  Awaited<ReturnType<typeof listRelationalAppointments>>
> {
  if (relationalAppointmentsEnabled()) {
    const { data } = await getStore();
    await ensureClinicAppointmentsMigrated(
      data.eyeExamAppointments || [],
      data.settings.appointmentSlotMinutes || 30,
    );
    return listRelationalAppointments();
  }
  return [];
}
