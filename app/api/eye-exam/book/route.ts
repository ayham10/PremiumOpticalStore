import { NextResponse } from "next/server";
import { newId } from "@/lib/auth";
import {
  handleRouteError,
  jsonError,
  pushActivity,
  pushSmsLog,
} from "@/lib/api/helpers";
import { updateStore } from "@/lib/db/store";
import {
  ensureFutureAvailability,
  eyeExamSmsBody,
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  hasEyeExamSlotConflict,
  isClinicAppointmentType,
  isValidEmail,
  isValidIsoDate,
  normalizeAppointmentType,
  normalizeIsraeliPhone,
  parseTimeToMinutes,
  resolvePublicAvailability,
  sanitizeName,
  todayInJerusalem,
  withEyeExamLock,
} from "@/lib/eye-exam";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import { sendSms } from "@/lib/sms/provider";
import type { ClinicAppointmentType, EyeExamAppointment } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const LOCALES = new Set<Locale>(["en", "he", "ar"]);

export async function POST(request: Request) {
  try {
    const limited = rateLimit(
      clientKeyFromRequest(request, "eye-exam-book"),
      8,
      60_000,
    );
    if (!limited.ok) {
      return jsonError("Too many booking attempts. Please try again shortly.", 429, {
        retryAfterSec: limited.retryAfterSec,
      });
    }

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      appointmentDate?: string;
      appointmentTime?: string;
      language?: string;
      appointmentType?: string;
      notes?: string;
      source?: string;
    };

    const firstName = sanitizeName(body.firstName || "");
    const lastName = sanitizeName(body.lastName || "");
    const email = (body.email || "").trim().toLowerCase();
    const phoneRaw = (body.phone || "").trim();
    const appointmentDate = (body.appointmentDate || "").trim();
    const appointmentTime = (body.appointmentTime || "").trim();
    const notes = (body.notes || "").trim().slice(0, 500) || undefined;
    const language = (LOCALES.has(body.language as Locale)
      ? body.language
      : "en") as Locale;
    const appointmentType: ClinicAppointmentType = isClinicAppointmentType(
      body.appointmentType,
    )
      ? body.appointmentType
      : normalizeAppointmentType(body.appointmentType);
    const fromAdmin = body.source === "admin";

    if (!firstName) return jsonError("First name is required", 400, { field: "firstName" });
    if (!lastName) return jsonError("Last name is required", 400, { field: "lastName" });
    if (!email || !isValidEmail(email)) {
      return jsonError("Enter a valid email address", 400, { field: "email" });
    }

    const phone = normalizeIsraeliPhone(phoneRaw);
    if (!phone) {
      return jsonError("Enter a valid Israeli phone number", 400, { field: "phone" });
    }

    if (!isValidIsoDate(appointmentDate)) {
      return jsonError("Select a valid date", 400, { field: "appointmentDate" });
    }
    if (parseTimeToMinutes(appointmentTime) == null) {
      return jsonError("Select a valid time", 400, { field: "appointmentTime" });
    }

    if (appointmentDate < todayInJerusalem()) {
      return jsonError("Selected date is in the past", 400, {
        field: "appointmentDate",
      });
    }

    let created: EyeExamAppointment | null = null;

    await withEyeExamLock(async () => {
      await updateStore(async (store) => {
        // Keep persisted days aligned with weekly schedule + exceptions
        store.eyeExamAvailability = ensureFutureAvailability(
          store.eyeExamAvailability,
          store.settings,
        );
        const availability = resolvePublicAvailability(
          store.eyeExamAvailability,
          store.settings,
        );
        const day = getOpenAvailabilityForDate(
          availability,
          appointmentDate,
          appointmentType,
        );
        if (!day) throw new Error("DATE_UNAVAILABLE");

        const slot = day.slots.find(
          (s) => s.time === appointmentTime && s.isEnabled,
        );
        if (!slot) throw new Error("TIME_UNAVAILABLE");

        if (
          hasEyeExamSlotConflict(
            store.eyeExamAppointments,
            appointmentDate,
            appointmentTime,
            undefined,
            { appointmentType, day },
          )
        ) {
          throw new Error("CONFLICT");
        }

        const now = new Date().toISOString();
        created = {
          id: newId("eea"),
          firstName,
          lastName,
          email,
          phone,
          appointmentDate,
          appointmentTime,
          appointmentType,
          status: "confirmed",
          language,
          ...(notes ? { notes } : {}),
          smsStatus: "pending",
          createdAt: now,
          updatedAt: now,
        };

        store.eyeExamAppointments.unshift(created);

        const dateDisplay = formatEyeExamDateDisplay(appointmentDate);
        const smsBody = eyeExamSmsBody(
          language,
          dateDisplay,
          appointmentTime,
          appointmentType,
        );
        const smsResult = await sendSms({
          to: phone,
          body: smsBody,
          type: "appointment_confirmation",
          appointmentId: created.id,
        });

        created.smsStatus = smsResult.status;
        if (!smsResult.ok) {
          created.smsError = smsResult.error || "SMS failed";
        }
        store.eyeExamAppointments[0] = created;

        pushSmsLog(store, {
          to: phone,
          body: smsBody,
          type: "appointment_confirmation",
          result: smsResult,
          appointmentId: created.id,
        });

        pushActivity(store, {
          actor: fromAdmin ? "admin" : email,
          action: fromAdmin ? "admin_manual_booking" : "public_booking",
          entity:
            appointmentType === "contact_lens_fitting"
              ? "contact_lens_fitting"
              : "eye_exam_appointment",
          entityId: created.id,
          detail: `${appointmentType} — ${firstName} ${lastName} — ${appointmentDate} ${appointmentTime}${
            notes ? ` — note: ${notes}` : ""
          }`,
        });

        return store;
      });
    });

    return NextResponse.json(
      {
        appointment: {
          id: created!.id,
          firstName: created!.firstName,
          lastName: created!.lastName,
          appointmentDate: created!.appointmentDate,
          appointmentTime: created!.appointmentTime,
          appointmentType: created!.appointmentType,
          dateLabel: formatEyeExamDateDisplay(created!.appointmentDate),
          status: created!.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DATE_UNAVAILABLE") {
        return jsonError("Selected date is not available", 409, {
          field: "appointmentDate",
        });
      }
      if (error.message === "TIME_UNAVAILABLE") {
        return jsonError("Selected time is not available", 409, {
          field: "appointmentTime",
        });
      }
      if (error.message === "CONFLICT") {
        return jsonError("This time slot is no longer available", 409, {
          field: "appointmentTime",
        });
      }
    }
    return handleRouteError(error);
  }
}
