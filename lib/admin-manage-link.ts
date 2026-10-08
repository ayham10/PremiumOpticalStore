import { isSilentManageTestAppointment } from "@/lib/booking-silent-test";
import {
  computeManageTokenExpiresAt,
  evaluateManageAccess,
  issueBookingManageToken,
} from "@/lib/booking-manage-token";
import type { EyeExamAppointment } from "@/lib/types";

export type AdminManageLinkBlockReason = "cancelled" | "expired";

export type AdminManageLinkStatus = {
  hasValidLink: boolean;
  canGenerate: boolean;
  reason?: AdminManageLinkBlockReason;
};

export type AdminManageLinkPlan =
  | { ok: false; error: "NOT_FOUND" }
  | { ok: false; error: "SILENT_TEST" }
  | { ok: false; error: "CANCELLED" }
  | { ok: false; error: "EXPIRED" }
  | { ok: false; error: "NEEDS_CONFIRM" }
  | {
      ok: true;
      token: string;
      next: EyeExamAppointment;
      rotated: boolean;
    };

const BOOKING_IDENTITY_KEYS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "appointmentDate",
  "appointmentTime",
  "appointmentType",
  "status",
  "language",
  "notes",
  "smsStatus",
  "smsError",
  "silentTest",
  "createdAt",
] as const;

export function bookingIdentitySnapshot(
  appointment: EyeExamAppointment,
): Record<(typeof BOOKING_IDENTITY_KEYS)[number], unknown> {
  return {
    id: appointment.id,
    firstName: appointment.firstName,
    lastName: appointment.lastName,
    email: appointment.email,
    phone: appointment.phone,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    appointmentType: appointment.appointmentType,
    status: appointment.status,
    language: appointment.language,
    notes: appointment.notes,
    smsStatus: appointment.smsStatus,
    smsError: appointment.smsError,
    silentTest: appointment.silentTest,
    createdAt: appointment.createdAt,
  };
}

export function adminManageLinkEligibility(
  appointment: EyeExamAppointment,
  slotMinutes = 30,
  now = new Date(),
):
  | { canGenerate: true }
  | { canGenerate: false; reason: AdminManageLinkBlockReason } {
  if (appointment.status === "cancelled") {
    return { canGenerate: false, reason: "cancelled" };
  }
  let expiresAt: string;
  try {
    expiresAt = computeManageTokenExpiresAt(
      appointment.appointmentDate,
      appointment.appointmentTime,
      slotMinutes,
    );
  } catch {
    return { canGenerate: false, reason: "expired" };
  }
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime()) {
    return { canGenerate: false, reason: "expired" };
  }
  return { canGenerate: true };
}

export function adminManageLinkStatus(
  appointment: EyeExamAppointment,
  slotMinutes = 30,
  now = new Date(),
): AdminManageLinkStatus {
  const eligibility = adminManageLinkEligibility(appointment, slotMinutes, now);
  return {
    hasValidLink: evaluateManageAccess(appointment, now).ok,
    canGenerate: eligibility.canGenerate,
    reason: eligibility.canGenerate ? undefined : eligibility.reason,
  };
}

export function applyIssuedAdminManageLink(
  appointment: EyeExamAppointment,
  issued: {
    manageTokenHash: string;
    manageTokenExpiresAt: string;
    manageTokenRevokedAt: null;
  },
  nowIso = new Date().toISOString(),
): EyeExamAppointment {
  return {
    ...appointment,
    manageTokenHash: issued.manageTokenHash,
    manageTokenExpiresAt: issued.manageTokenExpiresAt,
    manageTokenRevokedAt: issued.manageTokenRevokedAt,
    updatedAt: nowIso,
  };
}

export function planAdminManageLinkGeneration(
  appointment: EyeExamAppointment | null | undefined,
  opts: {
    confirmRotate?: boolean;
    slotMinutes?: number;
    now?: Date;
  } = {},
): AdminManageLinkPlan {
  if (!appointment) return { ok: false, error: "NOT_FOUND" };
  if (isSilentManageTestAppointment(appointment)) {
    return { ok: false, error: "SILENT_TEST" };
  }

  const now = opts.now || new Date();
  const slotMinutes = opts.slotMinutes || 30;
  const eligibility = adminManageLinkEligibility(appointment, slotMinutes, now);
  if (!eligibility.canGenerate) {
    return {
      ok: false,
      error: eligibility.reason === "cancelled" ? "CANCELLED" : "EXPIRED",
    };
  }

  const rotated = evaluateManageAccess(appointment, now).ok;
  if (rotated && !opts.confirmRotate) {
    return { ok: false, error: "NEEDS_CONFIRM" };
  }

  const issued = issueBookingManageToken(
    appointment.appointmentDate,
    appointment.appointmentTime,
    slotMinutes,
  );
  return {
    ok: true,
    token: issued.token,
    rotated,
    next: applyIssuedAdminManageLink(appointment, issued, now.toISOString()),
  };
}
