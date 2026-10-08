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
} from "@/lib/booking-manage-test";
import {
  issueBookingManageToken,
  publicManageAppointmentView,
} from "@/lib/booking-manage-token";
import { pickLocalized } from "@/lib/booking-services";
import { updateStore } from "@/lib/db/store";
import { formatEyeExamDateDisplay, withEyeExamLock } from "@/lib/eye-exam";
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
    return noStore(
      NextResponse.json({
        ok: allowed,
        allowed,
        vercelEnv: process.env.VERCEL_ENV || null,
        error: allowed ? undefined : UNAVAILABLE,
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
    let manageUrl = "";
    let publicView: ReturnType<typeof publicManageAppointmentView> | null = null;
    let dateLabel = "";
    let appointmentId = "";

    await withEyeExamLock(async () => {
      await updateStore((store) => {
        const slot = pickPreviewTestSlot(store);
        if (!slot) {
          throw new Error("NO_SLOT");
        }

        const slotMinutes = store.settings.appointmentSlotMinutes || 30;
        const issued = issueBookingManageToken(
          slot.date,
          slot.time,
          slotMinutes,
        );
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

        store.previewManageTestAppointments = capPreviewManageTestAppointments([
          created,
          ...(store.previewManageTestAppointments || []),
        ]);

        const service = store.bookingServices?.find(
          (item) => item.key === created.appointmentType,
        );
        const serviceLabel = service
          ? pickLocalized(service.name, created.language)
          : created.appointmentType;
        publicView = publicManageAppointmentView(created, serviceLabel);
        dateLabel = formatEyeExamDateDisplay(created.appointmentDate);
        manageUrl = bookingManageUrlForOrigin(origin, issued.token);
        appointmentId = created.id;
        return store;
      });
    });

    console.info("[booking-manage-test] created isolated fixture", {
      appointmentId,
      origin,
    });

    return noStore(
      NextResponse.json({
        ok: true,
        manageUrl,
        appointment: {
          ...publicView!,
          dateLabel,
        },
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SLOT") {
      return noStore(
        jsonError("No available clinic slot was found for a test booking.", 409),
      );
    }
    return handleRouteError(error);
  }
}
