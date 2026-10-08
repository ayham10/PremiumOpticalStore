import { NextResponse } from "next/server";
import { newId, requireSession } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api/helpers";
import {
  bookingManageOriginFromRequest,
  bookingManageTestMode,
  bookingManageUrlForOrigin,
  capPreviewManageTestAppointments,
  isBookingManagePreviewTestAllowed,
  pickPreviewTestSlot,
  pickSilentTestSlot,
  PREVIEW_TEST_EMAIL,
  PREVIEW_TEST_PHONE,
  previewTestServiceLabel,
  publicAdminTestAppointmentView,
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
import {
  SILENT_MANAGE_TEST_EMAIL,
  SILENT_MANAGE_TEST_MAX_APPOINTMENTS,
  SILENT_MANAGE_TEST_NOTES,
  SILENT_MANAGE_TEST_PHONE,
  isSilentManageTestAppointment,
} from "@/lib/booking-silent-test";
import { getStore, updateStore } from "@/lib/db/store";
import { formatEyeExamDateDisplay, withEyeExamLock } from "@/lib/eye-exam";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";
import type { EyeExamAppointment } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

async function requireBookingManageTestAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

function serviceLabelFor(appointment: EyeExamAppointment) {
  return previewTestServiceLabel(
    appointment.appointmentType,
    appointment.language,
  );
}

function listViews(items: EyeExamAppointment[]) {
  return items.map((item) =>
    publicAdminTestAppointmentView(item, serviceLabelFor(item)),
  );
}

export async function GET() {
  try {
    await requireBookingManageTestAdmin();
    const mode = bookingManageTestMode();
    if (mode === "disabled") {
      return noStore(
        NextResponse.json({
          ok: false,
          allowed: false,
          mode,
          vercelEnv: process.env.VERCEL_ENV || null,
          error: "This booking-manage test is not available.",
        }),
      );
    }

    if (mode === "preview-isolated") {
      const storage = publicPreviewTestStoreStatus();
      const appointments = storage.storageReady
        ? listViews(await readPreviewTestAppointments())
        : [];
      return noStore(
        NextResponse.json({
          ok: storage.storageReady,
          allowed: true,
          mode,
          vercelEnv: process.env.VERCEL_ENV || null,
          ...storage,
          appointments,
          error: storage.storageReady ? undefined : storage.error,
        }),
      );
    }

    const { data } = await getStore();
    const appointments = listViews(
      (data.eyeExamAppointments || []).filter(isSilentManageTestAppointment),
    );
    return noStore(
      NextResponse.json({
        ok: true,
        allowed: true,
        mode,
        vercelEnv: process.env.VERCEL_ENV || null,
        storageReady: true,
        appointments,
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireBookingManageTestAdmin();
    const mode = bookingManageTestMode();
    if (mode === "disabled") {
      return noStore(jsonError("This booking-manage test is not available.", 403));
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

    if (mode === "preview-isolated") {
      if (!isBookingManagePreviewTestAllowed()) {
        return noStore(jsonError("This booking-manage test is not available.", 403));
      }
      const storage = resolvePreviewTestStoreConfig();
      if (!storage.ok) {
        return noStore(
          jsonError(storage.error, 503, { missing: storage.missing }),
        );
      }

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
        silentTest: true,
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

      const serviceLabel = serviceLabelFor(created);
      const manageUrl = bookingManageUrlForOrigin(origin, issued.token);

      console.info("[booking-manage-test] created isolated fixture", {
        appointmentId: created.id,
        origin,
        storeId: storage.config.storeId,
      });

      return noStore(
        NextResponse.json({
          ok: true,
          mode,
          manageUrl,
          appointment: {
            ...publicManageAppointmentView(created, serviceLabel),
            ...publicAdminTestAppointmentView(created, serviceLabel),
          },
        }),
      );
    }

    let created: EyeExamAppointment | undefined;
    let manageUrl = "";

    await withEyeExamLock(async () => {
      await updateStore(async (store) => {
        const existingSilent = (store.eyeExamAppointments || []).filter(
          isSilentManageTestAppointment,
        );
        if (existingSilent.length >= SILENT_MANAGE_TEST_MAX_APPOINTMENTS) {
          throw new Error("TOO_MANY_SILENT_TESTS");
        }

        const slot = pickSilentTestSlot(store);
        if (!slot) throw new Error("NO_SLOT");

        const slotMinutes = store.settings.appointmentSlotMinutes || 30;
        const issued = issueBookingManageToken(
          slot.date,
          slot.time,
          slotMinutes,
        );
        const now = new Date().toISOString();
        const next: EyeExamAppointment = {
          id: newId("eea_test"),
          firstName: "OYON",
          lastName: "TEST",
          email: SILENT_MANAGE_TEST_EMAIL,
          phone: SILENT_MANAGE_TEST_PHONE,
          appointmentDate: slot.date,
          appointmentTime: slot.time,
          appointmentType: slot.appointmentType,
          status: "confirmed",
          language: "ar",
          notes: SILENT_MANAGE_TEST_NOTES,
          smsStatus: "simulated",
          silentTest: true,
          manageTokenHash: issued.manageTokenHash,
          manageTokenExpiresAt: issued.manageTokenExpiresAt,
          manageTokenRevokedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        store.eyeExamAppointments = [next, ...store.eyeExamAppointments];
        created = next;
        manageUrl = bookingManageUrlForOrigin(origin, issued.token);
        return store;
      });
    });

    if (!created || !manageUrl) {
      return noStore(jsonError("Unable to create the silent test appointment.", 500));
    }

    const serviceLabel = serviceLabelFor(created);
    console.info("[booking-manage-test] created silent production fixture", {
      appointmentId: created.id,
      origin,
    });

    return noStore(
      NextResponse.json({
        ok: true,
        mode,
        manageUrl,
        appointment: {
          ...publicManageAppointmentView(created, serviceLabel),
          ...publicAdminTestAppointmentView(created, serviceLabel),
        },
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "TOO_MANY_SILENT_TESTS") {
      return noStore(
        jsonError(
          `Delete an existing silent test first (max ${SILENT_MANAGE_TEST_MAX_APPOINTMENTS}).`,
          409,
        ),
      );
    }
    if (error instanceof Error && error.message === "NO_SLOT") {
      return noStore(
        jsonError("No available clinic slot was found for a test booking.", 409),
      );
    }
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireBookingManageTestAdmin();
    const mode = bookingManageTestMode();
    if (mode === "disabled") {
      return noStore(jsonError("This booking-manage test is not available.", 403));
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() || "";
    if (!id) return noStore(jsonError("Appointment id is required", 400));

    if (mode === "preview-isolated") {
      let removed = false;
      await withPreviewTestStoreLock(async () => {
        const existing = await readPreviewTestAppointments();
        const next = existing.filter((item) => item.id !== id);
        removed = next.length !== existing.length;
        if (removed) await writePreviewTestAppointments(next);
      });
      if (!removed) return noStore(jsonError("Test appointment not found", 404));
      return noStore(NextResponse.json({ ok: true, id }));
    }

    let removed = false;
    await withEyeExamLock(async () => {
      await updateStore(async (store) => {
        const index = store.eyeExamAppointments.findIndex(
          (item) => item.id === id && isSilentManageTestAppointment(item),
        );
        if (index < 0) throw new Error("NOT_FOUND");
        store.eyeExamAppointments.splice(index, 1);
        removed = true;
        return store;
      });
    });

    if (!removed) return noStore(jsonError("Test appointment not found", 404));
    console.info("[booking-manage-test] deleted silent production fixture", { id });
    return noStore(NextResponse.json({ ok: true, id }));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return noStore(jsonError("Test appointment not found", 404));
    }
    return handleRouteError(error);
  }
}
