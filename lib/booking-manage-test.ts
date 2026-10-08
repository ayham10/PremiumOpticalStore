import { BOOKING_MANAGE_ORIGIN } from "@/lib/booking-manage-constants";
import { bookingManageUrlForOrigin } from "@/lib/booking-manage-token";
import {
  createDefaultBookingServices,
  isActiveBookingServiceKey,
  pickLocalized,
} from "@/lib/booking-services";
import {
  customerFacingAppointments,
  isSilentManageTestAppointment,
} from "@/lib/booking-silent-test";
import {
  formatEyeExamDateDisplay,
  listBookableTimes,
  normalizeAppointmentType,
  resolvePublicAvailability,
} from "@/lib/eye-exam";
import { createSeedData } from "@/lib/seed";
import type { AppData, EyeExamAppointment } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

export const PREVIEW_TEST_MAX_APPOINTMENTS = 5;
export const PREVIEW_TEST_PHONE = "+972500000001";
export const PREVIEW_TEST_EMAIL = "preview-manage-test@oyonoptics.invalid";

export type BookingManageTestMode =
  | "preview-isolated"
  | "production-silent"
  | "disabled";

/** Production is always blocked. Preview, Vercel development, and local are allowed. */
export function isBookingManagePreviewTestAllowed(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  if (!vercelEnv) return nodeEnv !== "production";
  return false;
}

export function bookingManageTestMode(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): BookingManageTestMode {
  if (vercelEnv === "production") return "production-silent";
  if (isBookingManagePreviewTestAllowed(vercelEnv, nodeEnv)) {
    return "preview-isolated";
  }
  if (!vercelEnv && nodeEnv === "production") return "production-silent";
  return "disabled";
}

export function isBookingManageAdminTestAllowed(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return bookingManageTestMode(vercelEnv, nodeEnv) !== "disabled";
}

/** Skip live Twilio/WhatsApp on Preview, Vercel development, and local. Never skip Production. */
export function shouldSkipBookingWhatsApp(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  return !vercelEnv && nodeEnv !== "production";
}

export function bookingManageOriginFromRequest(
  request: Request,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): string {
  if (vercelEnv === "production") return BOOKING_MANAGE_ORIGIN;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim() || "";
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  const vercelUrl = (process.env.VERCEL_URL || "").replace(/^https?:\/\//, "").trim();

  if (host && !/oyonoptics\.com$/i.test(host.split(":")[0] || "")) {
    return `${proto}://${host}`;
  }
  if (vercelUrl) return `https://${vercelUrl}`;
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export { bookingManageUrlForOrigin };

export function capPreviewManageTestAppointments(
  items: EyeExamAppointment[],
  max = PREVIEW_TEST_MAX_APPOINTMENTS,
): EyeExamAppointment[] {
  return items.slice(0, max);
}

function pickSlotFromStore(
  store: AppData,
  appointments: EyeExamAppointment[],
): {
  date: string;
  time: string;
  appointmentType: EyeExamAppointment["appointmentType"];
} | null {
  const services = store.bookingServices?.length
    ? store.bookingServices
    : createDefaultBookingServices();
  const appointmentType = normalizeAppointmentType(
    services.find((item) => isActiveBookingServiceKey(item.key, services))
      ?.key || "eye_exam",
  );
  const days = resolvePublicAvailability(
    store.eyeExamAvailability,
    store.settings,
  );
  for (const day of days) {
    const times = listBookableTimes(day, appointments, {
      appointmentType,
    });
    if (times[0]) {
      return { date: day.date, time: times[0], appointmentType };
    }
  }
  return null;
}

/** Seed schedule only — never reads live customer appointments. */
export function pickPreviewTestSlot(
  store: AppData = createSeedData(),
): {
  date: string;
  time: string;
  appointmentType: EyeExamAppointment["appointmentType"];
} | null {
  return pickSlotFromStore(store, []);
}

/** Live clinic schedule, ignoring silent-test occupancy so customers keep the slot. */
export function pickSilentTestSlot(store: AppData): {
  date: string;
  time: string;
  appointmentType: EyeExamAppointment["appointmentType"];
} | null {
  return pickSlotFromStore(
    store,
    customerFacingAppointments(store.eyeExamAppointments || []),
  );
}

export function previewTestServiceLabel(
  appointmentType: string,
  language: Locale = "ar",
): string {
  const services = createDefaultBookingServices();
  const service = services.find((item) => item.key === appointmentType);
  return service
    ? pickLocalized(service.name, language, appointmentType)
    : appointmentType;
}

export function publicAdminTestAppointmentView(
  appointment: EyeExamAppointment,
  serviceLabel: string,
) {
  return {
    id: appointment.id,
    customerName: `${appointment.firstName} ${appointment.lastName}`.trim(),
    service: serviceLabel,
    appointmentDate: appointment.appointmentDate,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status,
    dateLabel: formatEyeExamDateDisplay(appointment.appointmentDate),
    silentTest: isSilentManageTestAppointment(appointment),
  };
}
