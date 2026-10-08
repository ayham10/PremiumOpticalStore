import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import {
  adminManageLinkStatus,
  planAdminManageLinkGeneration,
} from "@/lib/admin-manage-link";
import { bookingManageOriginFromRequest } from "@/lib/booking-manage-test";
import { bookingManageUrlForOrigin } from "@/lib/booking-manage-token";
import { getStore, updateStore } from "@/lib/db/store";
import { withEyeExamLock } from "@/lib/eye-exam";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

function errorForPlan(
  error: "NOT_FOUND" | "SILENT_TEST" | "CANCELLED" | "EXPIRED" | "NEEDS_CONFIRM",
) {
  if (error === "NOT_FOUND") return jsonError("Appointment not found", 404, { code: error });
  if (error === "SILENT_TEST") {
    return jsonError(
      "Silent test appointments can only be changed from the management link or deleted from the admin test page.",
      409,
      { code: error },
    );
  }
  if (error === "CANCELLED") {
    return jsonError(
      "A management link cannot be generated for a canceled appointment.",
      409,
      { code: error },
    );
  }
  if (error === "EXPIRED") {
    return jsonError(
      "A management link cannot be generated for an expired appointment.",
      409,
      { code: error },
    );
  }
  return jsonError(
    "A valid management link already exists. Confirm to replace it; the previous link will stop working.",
    409,
    { code: "NEEDS_CONFIRM", needsConfirm: true },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return noStore(jsonError("Appointment id is required", 400));

    const { data } = await getStore();
    const appointment = data.eyeExamAppointments.find((item) => item.id === id);
    if (!appointment) {
      return noStore(jsonError("Appointment not found", 404, { code: "NOT_FOUND" }));
    }

    const slotMinutes = data.settings.appointmentSlotMinutes || 30;
    const status = adminManageLinkStatus(appointment, slotMinutes);
    return noStore(
      NextResponse.json({
        appointmentId: appointment.id,
        hasValidLink: status.hasValidLink,
        canGenerate: status.canGenerate,
        reason: status.reason,
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const limited = rateLimit(
      clientKeyFromRequest(request, "admin-manage-link"),
      30,
      10 * 60_000,
    );
    if (!limited.ok) {
      const retry = jsonError("Too many link requests. Please try again shortly.", 429, {
        retryAfterSec: limited.retryAfterSec,
      });
      retry.headers.set("Retry-After", String(limited.retryAfterSec));
      return noStore(retry);
    }

    const body = (await request.json()) as {
      id?: string;
      confirmRotate?: boolean;
    };
    const id = body.id?.trim();
    if (!id) return noStore(jsonError("Appointment id is required", 400));

    const origin = bookingManageOriginFromRequest(request);
    let manageUrl = "";
    let rotated = false;

    await withEyeExamLock(async () => {
      await updateStore(async (store) => {
        const index = store.eyeExamAppointments.findIndex((item) => item.id === id);
        const current = index >= 0 ? store.eyeExamAppointments[index] : null;
        const plan = planAdminManageLinkGeneration(current, {
          confirmRotate: body.confirmRotate === true,
          slotMinutes: store.settings.appointmentSlotMinutes || 30,
        });
        if (!plan.ok) throw new Error(plan.error);
        store.eyeExamAppointments[index] = plan.next;
        manageUrl = bookingManageUrlForOrigin(origin, plan.token);
        rotated = plan.rotated;
        pushActivity(store, {
          actor: session.email,
          action: "update",
          entity: "eye_exam_appointment",
          entityId: id,
          detail: rotated
            ? "rotate_manage_link"
            : "generate_manage_link",
        });
        return store;
      });
    });

    return noStore(
      NextResponse.json({
        ok: true,
        manageUrl,
        rotated,
        hasValidLink: true,
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "NOT_FOUND" ||
        error.message === "SILENT_TEST" ||
        error.message === "CANCELLED" ||
        error.message === "EXPIRED" ||
        error.message === "NEEDS_CONFIRM"
      ) {
        return noStore(
          errorForPlan(
            error.message as
              | "NOT_FOUND"
              | "SILENT_TEST"
              | "CANCELLED"
              | "EXPIRED"
              | "NEEDS_CONFIRM",
          ),
        );
      }
    }
    return handleRouteError(error);
  }
}
