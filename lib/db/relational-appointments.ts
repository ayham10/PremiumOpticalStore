import { createHash, randomBytes } from "crypto";
import { supabaseConfig } from "@/lib/db/store";
import {
  isClinicAppointmentType,
  normalizeAppointmentType,
} from "@/lib/eye-exam";
import type {
  Appointment,
  AppointmentStatus,
  ClinicAppointmentType,
  EyeExamAppointment,
  EyeExamAppointmentStatus,
} from "@/lib/types";

export type RelationalAppointmentRow = {
  id: string;
  service: string;
  staff_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  manage_token: string;
  language: string;
  sms_status: string | null;
  sms_error: string | null;
  created_at: string;
  updated_at: string;
};

let migrationPromise: Promise<{ migrated: number; skipped: number }> | null =
  null;

function headers(config: NonNullable<ReturnType<typeof supabaseConfig>>) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export function relationalAppointmentsEnabled(): boolean {
  return Boolean(supabaseConfig());
}

export function clinicServiceLabel(type: ClinicAppointmentType): string {
  return type;
}

export function parseClinicService(service: string): ClinicAppointmentType | null {
  return isClinicAppointmentType(service) ? service : null;
}

function normalizeTime(value: string): string {
  // PostgREST may return "09:30:00"
  const m = value.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : value;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = normalizeTime(time).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function newManageToken(): string {
  return `tok_${randomBytes(12).toString("hex")}`;
}

/** Deterministic id for legacy JSON rows that somehow lack an id */
export function stableLegacyAppointmentId(input: {
  appointmentDate: string;
  appointmentTime: string;
  service: string;
  email: string;
  phone: string;
}): string {
  const raw = [
    input.service,
    input.appointmentDate,
    normalizeTime(input.appointmentTime),
    input.email.trim().toLowerCase(),
    input.phone.trim(),
  ].join("|");
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `eea_${hash}`;
}

export function rowToEyeExamAppointment(
  row: RelationalAppointmentRow,
): EyeExamAppointment {
  const nameParts = row.customer_name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const appointmentType = normalizeAppointmentType(row.service);
  const status = (
    ["confirmed", "completed", "cancelled", "no-show"].includes(row.status)
      ? row.status
      : "confirmed"
  ) as EyeExamAppointmentStatus;

  return {
    id: row.id,
    firstName,
    lastName,
    email: row.customer_email,
    phone: row.customer_phone,
    appointmentDate: row.appointment_date,
    appointmentTime: normalizeTime(row.start_time),
    appointmentType,
    status,
    language: (row.language === "ar" || row.language === "he"
      ? row.language
      : "en") as EyeExamAppointment["language"],
    smsStatus: (row.sms_status || "pending") as EyeExamAppointment["smsStatus"],
    smsError: row.sms_error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToAppointment(row: RelationalAppointmentRow): Appointment {
  const status = (
    [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "rescheduled",
      "no-show",
    ].includes(row.status)
      ? row.status
      : "confirmed"
  ) as AppointmentStatus;

  return {
    id: row.id,
    service: row.service as Appointment["service"],
    staffId: row.staff_id || "",
    customerId: row.customer_id || "",
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    date: row.appointment_date,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    status,
    notes: row.notes || undefined,
    manageToken: row.manage_token,
    language: row.language,
    smsStatus: row.sms_status || undefined,
    smsError: row.sms_error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eyeExamToInsertRow(
  appointment: EyeExamAppointment,
  slotMinutes = 30,
): Omit<RelationalAppointmentRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  const start = normalizeTime(appointment.appointmentTime);
  return {
    id: appointment.id,
    service: clinicServiceLabel(appointment.appointmentType),
    staff_id: null,
    customer_id: null,
    customer_name: `${appointment.firstName} ${appointment.lastName}`.trim(),
    customer_email: appointment.email,
    customer_phone: appointment.phone,
    appointment_date: appointment.appointmentDate,
    start_time: start,
    end_time: addMinutesToTime(start, slotMinutes),
    status: appointment.status,
    notes: null,
    manage_token: newManageToken(),
    language: appointment.language || "en",
    sms_status: appointment.smsStatus || "pending",
    sms_error: appointment.smsError || null,
    created_at: appointment.createdAt,
    updated_at: appointment.updatedAt,
  };
}

async function rest<T>(
  path: string,
  init?: RequestInit & { prefer?: string },
): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers(config),
      ...(init?.prefer ? { Prefer: init.prefer } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Appointments API failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function listRelationalAppointments(opts?: {
  status?: string;
  date?: string;
  service?: string;
  q?: string;
}): Promise<RelationalAppointmentRow[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "appointment_date.desc,start_time.desc");

  if (opts?.status) params.set("status", `eq.${opts.status}`);
  if (opts?.date) params.set("appointment_date", `eq.${opts.date}`);
  if (opts?.service) params.set("service", `eq.${opts.service}`);

  let rows = await rest<RelationalAppointmentRow[]>(
    `appointments?${params.toString()}`,
  );

  if (opts?.q) {
    const q = opts.q.toLowerCase();
    rows = rows.filter((row) =>
      [
        row.customer_name,
        row.customer_email,
        row.customer_phone,
        row.service,
        row.id,
        row.notes,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }

  return rows;
}

export async function listClinicAppointmentsAsEyeExam(): Promise<
  EyeExamAppointment[]
> {
  const rows = await listRelationalAppointments();
  return rows
    .filter((row) => isClinicAppointmentType(row.service) || !row.staff_id)
    .map(rowToEyeExamAppointment);
}

export async function getRelationalAppointmentById(
  id: string,
): Promise<RelationalAppointmentRow | null> {
  const rows = await rest<RelationalAppointmentRow[]>(
    `appointments?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function insertRelationalAppointment(
  row: ReturnType<typeof eyeExamToInsertRow>,
): Promise<RelationalAppointmentRow> {
  const created = await rest<RelationalAppointmentRow[]>("appointments", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(row),
  });
  if (!created?.[0]) throw new Error("Failed to insert appointment");
  return created[0];
}

export async function updateRelationalAppointment(
  id: string,
  patch: Partial<RelationalAppointmentRow>,
): Promise<RelationalAppointmentRow> {
  const updated = await rest<RelationalAppointmentRow[]>(
    `appointments?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!updated?.[0]) throw new Error("Appointment not found");
  return updated[0];
}

export async function findDuplicateRelationalAppointment(input: {
  id?: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  email?: string;
  phone?: string;
}): Promise<RelationalAppointmentRow | null> {
  if (input.id) {
    const byId = await getRelationalAppointmentById(input.id);
    if (byId) return byId;
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("service", `eq.${input.service}`);
  params.set("appointment_date", `eq.${input.appointmentDate}`);
  params.set("start_time", `eq.${normalizeTime(input.appointmentTime)}`);
  params.set("status", "neq.cancelled");
  params.set("limit", "5");

  const rows = await rest<RelationalAppointmentRow[]>(
    `appointments?${params.toString()}`,
  );
  if (!rows.length) return null;

  if (input.email || input.phone) {
    const email = (input.email || "").toLowerCase();
    const phone = input.phone || "";
    const match = rows.find(
      (row) =>
        (email && row.customer_email.toLowerCase() === email) ||
        (phone && row.customer_phone === phone),
    );
    if (match) return match;
  }

  return rows[0];
}

/**
 * One-time / idempotent migration from lumina_store.payload.eyeExamAppointments
 * into public.appointments. Never deletes or clears the JSON payload.
 */
export async function migrateJsonClinicAppointmentsToRelational(
  jsonAppointments: EyeExamAppointment[],
  slotMinutes = 30,
): Promise<{ migrated: number; skipped: number }> {
  if (!relationalAppointmentsEnabled()) {
    return { migrated: 0, skipped: jsonAppointments.length };
  }

  let migrated = 0;
  let skipped = 0;

  for (const raw of jsonAppointments) {
    const appointmentType = normalizeAppointmentType(raw.appointmentType);
    const id =
      raw.id ||
      stableLegacyAppointmentId({
        appointmentDate: raw.appointmentDate,
        appointmentTime: raw.appointmentTime,
        service: appointmentType,
        email: raw.email,
        phone: raw.phone,
      });

    const existing = await findDuplicateRelationalAppointment({
      id,
      service: appointmentType,
      appointmentDate: raw.appointmentDate,
      appointmentTime: raw.appointmentTime,
      email: raw.email,
      phone: raw.phone,
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      await insertRelationalAppointment(
        eyeExamToInsertRow(
          {
            ...raw,
            id,
            appointmentType,
          },
          slotMinutes,
        ),
      );
      migrated += 1;
    } catch (error) {
      // Unique violation / race → treat as already migrated
      const message = error instanceof Error ? error.message : "";
      if (message.includes("409") || message.toLowerCase().includes("duplicate")) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return { migrated, skipped };
}

export async function ensureClinicAppointmentsMigrated(
  jsonAppointments: EyeExamAppointment[],
  slotMinutes = 30,
): Promise<{ migrated: number; skipped: number }> {
  if (!relationalAppointmentsEnabled()) {
    return { migrated: 0, skipped: 0 };
  }
  if (!migrationPromise) {
    migrationPromise = migrateJsonClinicAppointmentsToRelational(
      jsonAppointments,
      slotMinutes,
    ).catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}
