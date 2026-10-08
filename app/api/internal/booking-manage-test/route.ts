import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import {
  bookingManageOriginFromRequest,
  bookingManageUrlForOrigin,
  capPreviewManageTestAppointments,
  isBookingManagePreviewTestAllowed,
  pickPreviewTestSlot,
  PREVIEW_TEST_EMAIL,
  PREVIEW_TEST_PHONE,
  previewTestServiceLabel,
} from "@/lib/booking-manage-test";
import {
  publicPreviewTestStoreStatus,
  readPreviewTestAppointments,
  resolvePreviewTestStoreConfig,
  withPreviewTestStoreLock,
  writePreviewTestAppointments,
} from "@/lib/booking-manage-test-store";
import {
  issueBookingManageToken,
  publicManageAppointmentView,
} from "@/lib/booking-manage-token";
import { formatEyeExamDateDisplay } from "@/lib/eye-exam";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import type { EyeExamAppointment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UNAVAILABLE =
  "This booking-manage test is not available in Production.";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET() {
  try {
    await requireSession("appointments");
    const allowed = isBookingManagePreviewTestAllowed();
    const storage = publicPreviewTestStoreStatus();
    return noStore(
      NextResponse.json({
        ok: allowed && storage.storageReady,
        allowed,
        vercelEnv: process.env.VERCEL_ENV || null,
        ...storage,
        error: allowed
          ? storage.storageReady
            ? undefined
            : storage.error
          : UNAVAILABLE,
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSession("appointments");
    if (!isBookingManagePreviewTestAllowed()) {
      return noStore(jsonError(UNAVAILABLE, 403));
    }

    const storage = resolvePreviewTestStoreConfig();
    if (!storage.ok) {
      return noStore(
        jsonError(storage.error, 503, { missing: storage.missing }),
      );
    }

    const limited = rateLimit(
      clientKeyFromRequest(request, "booking-manage-test"),
      5,
      10 * 60_000,
    );
    if (!limited.ok) {
      const retry = jsonError("Too many test bookings. Please try again shortly.", 429, {
        retryAfterSec: limited.retryAfterSec,
      });
      retry.headers.set("Retry-After", String(limited.retryAfterSec));
      return noStore(retry);
    }

    const origin = bookingManageOriginFromRequest(request);
    const slot = pickPreviewTestSlot();
    if (!slot) {
      return noStore(
        jsonError("No available clinic slot was found for a test booking.", 409),
      );
    }

    const issued = issueBookingManageToken(slot.date, slot.time, 30);
    const now = new Date().toISOString();
    const created: EyeExamAppointment = {
      id: newId("eea_test"),
      firstName: "Preview",
      lastName: "Test",
      email: PREVIEW_TEST_EMAIL,
      phone: PREVIEW_TEST_PHONE,
      appointmentDate: slot.date,
      appointmentTime: slot.time,
      appointmentType: slot.appointmentType,
      status: "confirmed",
      language: "ar",
      notes: "[PREVIEW-TEST] Isolated booking-manage fixture. Not a customer booking.",
      smsStatus: "simulated",
      manageTokenHash: issued.manageTokenHash,
      manageTokenExpiresAt: issued.manageTokenExpiresAt,
      manageTokenRevokedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await withPreviewTestStoreLock(async () => {
      const existing = await readPreviewTestAppointments();
      await writePreviewTestAppointments(
        capPreviewManageTestAppointments([created, ...existing]),
      );
    });

    const serviceLabel = previewTestServiceLabel(
      created.appointmentType,
      created.language,
    );
    const manageUrl = bookingManageUrlForOrigin(origin, issued.token);

    console.info("[booking-manage-test] created isolated fixture", {
      appointmentId: created.id,
      origin,
      storeId: storage.config.storeId,
    });

    return noStore(
      NextResponse.json({
        ok: true,
        manageUrl,
        appointment: {
          ...publicManageAppointmentView(created, serviceLabel),
          dateLabel: formatEyeExamDateDisplay(created.appointmentDate),
        },
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
