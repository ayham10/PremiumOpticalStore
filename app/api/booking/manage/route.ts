import { NextResponse } from "next/server";
import { handleRouteError, jsonError, pushActivity } from "@/lib/api/helpers";
import { getStore, updateStore } from "@/lib/db/store";
import { pickLocalized } from "@/lib/booking-services";
import { isBookingManagePreviewTestAllowed } from "@/lib/booking-manage-test";
import {
  canCustomerMutateBooking,
  computeManageTokenExpiresAt,
  evaluateManageAccess,
  findAppointmentByManageTokenHash,
  manageAccessMessage,
  publicManageAppointmentView,
} from "@/lib/booking-manage-token";
import type { AppData, EyeExamAppointment } from "@/lib/types";
import {
  formatEyeExamDateDisplay,
  getOpenAvailabilityForDate,
  hasEyeExamSlotConflict,
  isValidIsoDate,
  normalizeAppointmentType,
  parseTimeToMinutes,
  resolveAvailabilityDay,
  withEyeExamLock,
} from "@/lib/eye-exam";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function tokenFromRequest(request: Request, body?: { token?: string }): string {
  const header =
    request.headers.get("x-booking-token")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (header) return header;
  return (body?.token || "").trim();
}

function locateManageAppointment(
  store: AppData,
  token: string,
): { appointment: EyeExamAppointment | null; previewTest: boolean } {
  const live = findAppointmentByManageTokenHash(
    store.eyeExamAppointments,
    token,
  );
  if (live) return { appointment: live, previewTest: false };
  if (!isBookingManagePreviewTestAllowed()) {
    return { appointment: null, previewTest: false };
  }
  const preview = findAppointmentByManageTokenHash(
    store.previewManageTestAppointments || [],
    token,
  );
  return { appointment: preview, previewTest: Boolean(preview) };
}

function fail(reason: "not_found" | "expired" | "revoked") {
  const status = reason === "not_found" ? 404 : 410;
  return jsonError(manageAccessMessage(reason), status, { reason });
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function GET(request: Request) {
  try {
    const limited = rateLimit(
      clientKeyFromRequest(request, "booking-manage-get"),
      20,
      60_000,
    );
    if (!limited.ok) {
      const retry = jsonError("Too many requests. Please try again shortly.", 429, {
        retryAfterSec: limited.retryAfterSec,
      });
      retry.headers.set("Retry-After", String(limited.retryAfterSec));
      return noStore(retry);
    }

    const token = tokenFromRequest(request);
    const { data } = await getStore();
    const located = locateManageAppointment(data, token);
    const access = evaluateManageAccess(located.appointment);
    if (!access.ok) return noStore(fail(access.reason));

    const service = data.bookingServices?.find(
      (item) => item.key === access.appointment.appointmentType,
    );
    const serviceLabel = service
      ? pickLocalized(service.name, access.appointment.language)
      : access.appointment.appointmentType;

    return noStore(
      NextResponse.json({
        appointment: {
          ...publicManageAppointmentView(access.appointment, serviceLabel),
          dateLabel: formatEyeExamDateDisplay(access.appointment.appointmentDate),
        },
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const limited = rateLimit(
      clientKeyFromRequest(request, "booking-manage-patch"),
      8,
      60_000,
    );
    if (!limited.ok) {
      const retry = jsonError("Too many requests. Please try again shortly.", 429, {
        retryAfterSec: limited.retryAfterSec,
      });
      retry.headers.set("Retry-After", String(limited.retryAfterSec));
      return noStore(retry);
    }

    const body = (await request.json().catch(() => ({}))) as {
      token?: string;
      action?: string;
      appointmentDate?: string;
      appointmentTime?: string;
    };
    const token = tokenFromRequest(request, body);
    const action = body.action === "reschedule" ? "reschedule" : body.action === "cancel" ? "cancel" : "";
    if (!action) {
      return noStore(jsonError("Action must be cancel or reschedule.", 400));
    }

    let publicView: ReturnType<typeof publicManageAppointmentView> | null = null;
    let dateLabel = "";

    await withEyeExamLock(async () => {
      await updateStore(async (store) => {
        const located = locateManageAppointment(store, token);
        const access = evaluateManageAccess(located.appointment);
        if (!access.ok) throw new Error(access.reason.toUpperCase());
        if (!canCustomerMutateBooking(access.appointment)) {
          throw new Error("NOT_MUTABLE");
        }

        const list = located.previewTest
          ? store.previewManageTestAppointments || []
          : store.eyeExamAppointments;
        const index = list.findIndex(
          (item) => item.id === access.appointment.id,
        );
        if (index < 0) throw new Error("NOT_FOUND");

        const current = list[index];
        const now = new Date().toISOString();
        const slotMinutes = store.settings.appointmentSlotMinutes || 30;

        if (action === "cancel") {
          const updated = {
            ...current,
            status: "cancelled" as const,
            manageTokenRevokedAt: now,
            updatedAt: now,
          };
          list[index] = updated;
          if (located.previewTest) {
            store.previewManageTestAppointments = list;
          } else {
            store.eyeExamAppointments = list;
          }
          const service = store.bookingServices?.find(
            (item) => item.key === updated.appointmentType,
          );
          const serviceLabel = service
            ? pickLocalized(service.name, updated.language)
            : updated.appointmentType;
          publicView = publicManageAppointmentView(updated, serviceLabel);
          dateLabel = formatEyeExamDateDisplay(updated.appointmentDate);
          if (!located.previewTest) {
            pushActivity(store, {
              actor: "customer",
              action: "cancel",
              entity: "eye_exam_appointment",
              entityId: current.id,
              detail: "customer cancelled via manage link",
            });
          }
          return store;
        }

        const nextDate = (body.appointmentDate || "").trim();
        const nextTime = (body.appointmentTime || "").trim();
        if (!isValidIsoDate(nextDate)) throw new Error("INVALID_DATE");
        if (parseTimeToMinutes(nextTime) == null) throw new Error("INVALID_TIME");

        const nextType = normalizeAppointmentType(current.appointmentType);
        const existingDay = store.eyeExamAvailability.find(
          (item) => item.date === nextDate,
        );
        const resolved = located.previewTest
          ? resolveAvailabilityDay(existingDay, store.settings, nextDate)
          : existingDay;
        const day =
          resolved && resolved.isOpen
            ? getOpenAvailabilityForDate([resolved], nextDate, nextType)
            : getOpenAvailabilityForDate(
                store.eyeExamAvailability,
                nextDate,
                nextType,
              );
        if (!day) throw new Error("DATE_UNAVAILABLE");
        const slot = day.slots.find((item) => item.time === nextTime && item.isEnabled);
        if (!slot) throw new Error("TIME_UNAVAILABLE");
        if (
          hasEyeExamSlotConflict(
            store.eyeExamAppointments,
            nextDate,
            nextTime,
            current.id,
            { appointmentType: nextType, day },
          )
        ) {
          throw new Error("SLOT_TAKEN");
        }

        const updated = {
          ...current,
          appointmentDate: nextDate,
          appointmentTime: nextTime,
          manageTokenExpiresAt: computeManageTokenExpiresAt(
            nextDate,
            nextTime,
            slotMinutes,
          ),
          updatedAt: now,
        };
        list[index] = updated;
        if (located.previewTest) {
          store.previewManageTestAppointments = list;
        } else {
          store.eyeExamAppointments = list;
        }
        const service = store.bookingServices?.find(
          (item) => item.key === updated.appointmentType,
        );
        const serviceLabel = service
          ? pickLocalized(service.name, updated.language)
          : updated.appointmentType;
        publicView = publicManageAppointmentView(updated, serviceLabel);
        dateLabel = formatEyeExamDateDisplay(updated.appointmentDate);
        if (!located.previewTest) {
          pushActivity(store, {
            actor: "customer",
            action: "update",
            entity: "eye_exam_appointment",
            entityId: current.id,
            detail: `customer reschedule ${nextDate} ${nextTime}`,
          });
        }
        return store;
      });
    });

    return noStore(
      NextResponse.json({
        appointment: { ...publicView!, dateLabel },
      }),
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") return noStore(fail("not_found"));
      if (error.message === "EXPIRED") return noStore(fail("expired"));
      if (error.message === "REVOKED") return noStore(fail("revoked"));
      if (error.message === "NOT_MUTABLE") {
        return noStore(jsonError("This booking can no longer be changed.", 409));
      }
      if (error.message === "INVALID_DATE") {
        return noStore(jsonError("Select a valid date", 400));
      }
      if (error.message === "INVALID_TIME") {
        return noStore(jsonError("Select a valid time", 400));
      }
      if (error.message === "DATE_UNAVAILABLE") {
        return noStore(jsonError("Selected date is not available", 409));
      }
      if (error.message === "TIME_UNAVAILABLE") {
        return noStore(jsonError("Selected time is not available", 409));
      }
      if (error.message === "SLOT_TAKEN") {
        return noStore(jsonError("This time slot is no longer available", 409));
      }
    }
    return handleRouteError(error);
  }
}
