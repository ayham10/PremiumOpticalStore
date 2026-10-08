import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { jerusalemWallClockToUtc } from "@/lib/eye-exam";
import type { EyeExamAppointment } from "@/lib/types";
import {
  BOOKING_MANAGE_ORIGIN,
  BOOKING_MANAGE_PATH,
  CUSTOMER_MANAGE_TEMPLATE_NAME_AR,
  CUSTOMER_MANAGE_TEMPLATE_NAME_HE,
  EXPIRED_MANAGE_LINK_MESSAGE,
  EXPIRED_MANAGE_LINK_MESSAGE_EN,
  EXPIRED_MANAGE_LINK_MESSAGE_HE,
} from "@/lib/booking-manage-constants";

export {
  BOOKING_MANAGE_CTA_URL,
  BOOKING_MANAGE_ORIGIN,
  BOOKING_MANAGE_PATH,
  CUSTOMER_MANAGE_TEMPLATE_NAME,
  CUSTOMER_MANAGE_TEMPLATE_NAME_AR,
  CUSTOMER_MANAGE_TEMPLATE_NAME_HE,
  EXPIRED_MANAGE_LINK_MESSAGE,
  EXPIRED_MANAGE_LINK_MESSAGE_EN,
  EXPIRED_MANAGE_LINK_MESSAGE_HE,
  REVOKED_MANAGE_LINK_MESSAGE,
} from "@/lib/booking-manage-constants";

export function manageTemplateNameForLanguage(
  language?: string | null,
): string {
  return language === "he"
    ? CUSTOMER_MANAGE_TEMPLATE_NAME_HE
    : CUSTOMER_MANAGE_TEMPLATE_NAME_AR;
}

export function hashBookingManageToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateBookingManageToken(): string {
  return randomBytes(32).toString("base64url");
}

export function bookingManageUrl(token: string): string {
  return `${BOOKING_MANAGE_ORIGIN}${BOOKING_MANAGE_PATH}/${encodeURIComponent(token)}`;
}

export function bookingManageUrlForOrigin(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${BOOKING_MANAGE_PATH}/${encodeURIComponent(token)}`;
}

/** Twilio CTA dynamic path parameter — not the full URL. */
export function bookingManageUrlParam(token: string): string {
  return token;
}

export function computeManageTokenExpiresAt(
  appointmentDate: string,
  startTime: string,
  _slotMinutes = 30,
): string {
  const startUtc = jerusalemWallClockToUtc(appointmentDate, startTime);
  if (!startUtc) {
    throw new Error("INVALID_APPOINTMENT_START");
  }
  return startUtc.toISOString();
}

/** Effective expiry is the appointment start, even if a stored value is later. */
export function manageLinkExpiresAtMs(
  appointment: Pick<
    EyeExamAppointment,
    "appointmentDate" | "appointmentTime" | "manageTokenExpiresAt"
  >,
): number | null {
  const startUtc = jerusalemWallClockToUtc(
    appointment.appointmentDate,
    appointment.appointmentTime,
  );
  const startMs = startUtc ? startUtc.getTime() : Number.NaN;
  const storedMs = appointment.manageTokenExpiresAt
    ? Date.parse(appointment.manageTokenExpiresAt)
    : Number.NaN;
  const candidates = [startMs, storedMs].filter((value) => Number.isFinite(value));
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function issueBookingManageToken(
  appointmentDate: string,
  startTime: string,
  slotMinutes = 30,
): {
  token: string;
  manageTokenHash: string;
  manageTokenExpiresAt: string;
  manageTokenRevokedAt: null;
} {
  const token = generateBookingManageToken();
  return {
    token,
    manageTokenHash: hashBookingManageToken(token),
    manageTokenExpiresAt: computeManageTokenExpiresAt(
      appointmentDate,
      startTime,
      slotMinutes,
    ),
    manageTokenRevokedAt: null,
  };
}

function hashesEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== 32 || right.length !== 32) return false;
  return timingSafeEqual(left, right);
}

export function findAppointmentByManageTokenHash(
  appointments: EyeExamAppointment[],
  rawToken: string,
): EyeExamAppointment | null {
  const token = rawToken.trim();
  if (!token || token.length < 20 || token.length > 128) return null;
  const expected = hashBookingManageToken(token);
  return (
    appointments.find(
      (item) =>
        typeof item.manageTokenHash === "string" &&
        hashesEqual(item.manageTokenHash, expected),
    ) || null
  );
}

export type ManageAccessFailure = "not_found" | "expired" | "revoked";

export function evaluateManageAccess(
  appointment: EyeExamAppointment | null,
  now = new Date(),
):
  | { ok: true; appointment: EyeExamAppointment }
  | { ok: false; reason: ManageAccessFailure } {
  if (!appointment) return { ok: false, reason: "not_found" };
  if (typeof appointment.manageTokenHash !== "string" || !appointment.manageTokenHash) {
    return { ok: false, reason: "not_found" };
  }
  if (appointment.manageTokenRevokedAt) return { ok: false, reason: "revoked" };
  const expires = manageLinkExpiresAtMs(appointment);
  if (expires == null || expires <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, appointment };
}

export function manageAccessMessage(
  reason: ManageAccessFailure,
  language?: string | null,
): string {
  if (reason === "expired" || reason === "revoked") {
    if (language === "he") return EXPIRED_MANAGE_LINK_MESSAGE_HE;
    if (language === "en") return EXPIRED_MANAGE_LINK_MESSAGE_EN;
    return EXPIRED_MANAGE_LINK_MESSAGE;
  }
  return "Appointment not found";
}

export function publicManageAppointmentView(
  appointment: EyeExamAppointment,
  serviceLabel: string,
) {
  return {
    customerName: `${appointment.firstName} ${appointment.lastName}`.trim(),
    service: serviceLabel,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status,
    appointmentType: appointment.appointmentType,
  };
}

export function omitManageTokenSecrets<T extends EyeExamAppointment>(
  appointment: T,
): Omit<T, "manageTokenHash"> {
  const { manageTokenHash: _hash, ...rest } = appointment;
  void _hash;
  return rest;
}

export function buildManageTemplateContentVariables(opts: {
  customerName: string;
  serviceLabel: string;
  dateLabel: string;
  time: string;
  token: string;
}): Record<string, string> {
  return {
    "1": opts.customerName,
    "2": opts.serviceLabel,
    "3": opts.dateLabel,
    "4": opts.time,
    "5": bookingManageUrlParam(opts.token),
  };
}

export function canCustomerMutateBooking(
  appointment: EyeExamAppointment,
): boolean {
  return appointment.status === "confirmed";
}
