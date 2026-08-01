import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/helpers";
import {
  ensureClinicAppointmentsMigrated,
  listAppointmentsForAdminDashboard,
} from "@/lib/db/clinic-appointments";
import { relationalAppointmentsEnabled } from "@/lib/db/relational-appointments";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

/**
 * Idempotent migration: copy lumina_store.payload.eyeExamAppointments
 * into public.appointments without deleting or clearing the JSON payload.
 */
export async function POST() {
  try {
    await requireSession("settings");

    if (!relationalAppointmentsEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Supabase is not configured",
        },
        { status: 400 },
      );
    }

    const { data } = await getStore();
    const result = await ensureClinicAppointmentsMigrated(
      data.eyeExamAppointments || [],
      data.settings.appointmentSlotMinutes || 30,
    );
    const rows = await listAppointmentsForAdminDashboard();

    const target = rows.find(
      (row) =>
        row.service === "eye_exam" &&
        row.appointment_date === "2026-08-06" &&
        row.start_time.startsWith("09:30") &&
        row.status !== "cancelled",
    );

    return NextResponse.json({
      ok: true,
      source: "lumina_store.payload.eyeExamAppointments",
      target: "public.appointments",
      migrated: result.migrated,
      skipped: result.skipped,
      totalRelational: rows.length,
      jsonCount: (data.eyeExamAppointments || []).length,
      verifiedEyeExam0608260930: Boolean(target),
      sample: target
        ? {
            id: target.id,
            service: target.service,
            customer_name: target.customer_name,
            appointment_date: target.appointment_date,
            start_time: target.start_time,
            status: target.status,
          }
        : null,
      note: "JSON payload was not deleted or overwritten.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    await requireSession("settings");
    const { data } = await getStore();
    let relationalCount = 0;
    let verified = false;
    if (relationalAppointmentsEnabled()) {
      const rows = await listAppointmentsForAdminDashboard();
      relationalCount = rows.length;
      verified = rows.some(
        (row) =>
          row.service === "eye_exam" &&
          row.appointment_date === "2026-08-06" &&
          row.start_time.startsWith("09:30") &&
          row.status !== "cancelled",
      );
    }
    return NextResponse.json({
      relationalEnabled: relationalAppointmentsEnabled(),
      jsonCount: (data.eyeExamAppointments || []).length,
      relationalCount,
      verifiedEyeExam0608260930: verified,
      migrationSql:
        "supabase/migrations/20260801_clinic_appointments_source_of_truth.sql",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
