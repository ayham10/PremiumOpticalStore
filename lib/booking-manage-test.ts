import { bookingManageUrlForOrigin } from "@/lib/booking-manage-token";
import { isActiveBookingServiceKey } from "@/lib/booking-services";
import {
  listBookableTimes,
  resolvePublicAvailability,
} from "@/lib/eye-exam";
import type { AppData, EyeExamAppointment } from "@/lib/types";

export const PREVIEW_TEST_MAX_APPOINTMENTS = 5;
export const PREVIEW_TEST_PHONE = "+972500000001";
export const PREVIEW_TEST_EMAIL = "preview-manage-test@oyonoptics.invalid";

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

/** Skip live Twilio/WhatsApp on Preview, Vercel development, and local. Never skip Production. */
export function shouldSkipBookingWhatsApp(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;
  return !vercelEnv && nodeEnv !== "production";
}

export function bookingManageOriginFromRequest(request: Request): string {
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

export function pickPreviewTestSlot(store: AppData): {
  date: string;
  time: string;
  appointmentType: string;
} | null {
  const appointmentType =
    store.bookingServices?.find((item) =>
      isActiveBookingServiceKey(item.key, store.bookingServices || []),
    )?.key || "eye_exam";
  const days = resolvePublicAvailability(
    store.eyeExamAvailability,
    store.settings,
  );
  for (const day of days) {
    const times = listBookableTimes(day, store.eyeExamAppointments, {
      appointmentType,
    });
    if (times[0]) {
      return { date: day.date, time: times[0], appointmentType };
    }
  }
  return null;
}

