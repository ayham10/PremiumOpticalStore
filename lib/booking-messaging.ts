import { pushSmsLog } from "@/lib/api/helpers";
import { mergeBookingMessages } from "@/lib/booking-messages";
import { pickLocalized } from "@/lib/booking-services";
import { getStore, invalidateStoreCache, updateStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  jerusalemWallClockToUtc,
} from "@/lib/eye-exam";
import type { SmsResult } from "@/lib/sms/provider";
import type { EyeExamAppointment } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import {
  logWhatsAppBookingResult,
  sendWhatsAppTemplate,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/provider";

function buildBookingContentVariables(
  appointment: EyeExamAppointment,
  serviceLabel: string,
): Record<string, string> {
  const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
  const dateLabel = formatEyeExamDateDisplay(appointment.appointmentDate);

  return {
    "1": customerName,
    "2": dateLabel,
    "3": appointment.appointmentTime,
    "4": serviceLabel,
    "5": appointment.phone,
    customer_name: customerName,
    appointment_date: dateLabel,
    appointment_time: appointment.appointmentTime,
    service_name: serviceLabel,
    customer_phone: appointment.phone,
  };
}

function resolveServiceLabel(
  appointment: EyeExamAppointment,
  bookingServices: { key: string; name: Parameters<typeof pickLocalized>[0] }[],
): string {
  const locale = (appointment.language || "en") as Locale;
  const match = bookingServices.find((s) => s.key === appointment.appointmentType);
  if (match) {
    return pickLocalized(match.name, locale, appointment.appointmentType);
  }
  return appointment.appointmentType;
}

function toSmsResult(result: WhatsAppSendResult): SmsResult {
  return {
    ok: result.ok,
    provider: result.provider,
    status:
      result.status === "queued"
        ? "queued"
        : result.status === "sent"
          ? "sent"
          : result.status === "skipped"
            ? "simulated"
            : "failed",
    error: result.error,
    externalId: result.externalId,
  };
}

async function logWhatsAppAttempt(
  appointment: EyeExamAppointment,
  opts: {
    to: string;
    type: "appointment_confirmation" | "appointment_reminder" | "custom";
    templateName: string;
    result: WhatsAppSendResult;
    note?: string;
  },
): Promise<void> {
  try {
    await updateStore((store) => {
      pushSmsLog(store, {
        to: opts.to,
        body: `WhatsApp:${opts.templateName}${opts.note ? ` (${opts.note})` : ""}`,
        type: opts.type,
        result: toSmsResult(opts.result),
        appointmentId: appointment.id,
      });
      return store;
    });
  } catch (error) {
    console.error("[WhatsApp] failed to persist message log", {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : "log persist failed",
    });
  }
}

async function sendConfiguredTemplate(
  appointment: EyeExamAppointment,
  opts: {
    to: string;
    templateName: string;
    contentVariables: Record<string, string>;
    kind: "customer_confirmation" | "owner_notification" | "appointment_reminder";
    smsType: "appointment_confirmation" | "appointment_reminder" | "custom";
    sendAt?: Date;
    note?: string;
  },
): Promise<void> {
  const result = await sendWhatsAppTemplate({
    to: opts.to,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
    sendAt: opts.sendAt,
  });

  logWhatsAppBookingResult(result, {
    appointmentId: appointment.id,
    to: opts.to,
    kind: opts.kind,
  });

  await logWhatsAppAttempt(appointment, {
    to: opts.to,
    type: opts.smsType,
    templateName: opts.templateName,
    result,
    note: opts.note,
  });
}

/**
 * Dispatch Twilio WhatsApp messages after a booking is saved.
 * Never throws — messaging failures must not affect the booking.
 */
export async function dispatchBookingMessages(
  appointment: EyeExamAppointment,
): Promise<void> {
  try {
    invalidateStoreCache();
    const { data: store } = await getStore();
    const bookingMessages = mergeBookingMessages(store.settings.bookingMessages);

    if (bookingMessages.provider === "console") {
      console.info("[WhatsApp] console provider — skipping Twilio send", {
        appointmentId: appointment.id,
      });
      return;
    }

    if (bookingMessages.provider !== "twilio") {
      console.info("[WhatsApp] unsupported provider — skipping", {
        appointmentId: appointment.id,
        provider: bookingMessages.provider,
      });
      return;
    }

    const serviceLabel = resolveServiceLabel(
      appointment,
      store.bookingServices || [],
    );
    const contentVariables = buildBookingContentVariables(appointment, serviceLabel);

    if (
      bookingMessages.customerConfirmation.enabled &&
      bookingMessages.customerConfirmation.templateName.trim()
    ) {
      await sendConfiguredTemplate(appointment, {
        to: appointment.phone,
        templateName: bookingMessages.customerConfirmation.templateName.trim(),
        contentVariables,
        kind: "customer_confirmation",
        smsType: "appointment_confirmation",
      });
    }

    const ownerWhatsApp =
      bookingMessages.ownerNotification.ownerWhatsApp.trim();
    if (
      bookingMessages.ownerNotification.enabled &&
      ownerWhatsApp &&
      bookingMessages.ownerNotification.templateName.trim()
    ) {
      await sendConfiguredTemplate(appointment, {
        to: ownerWhatsApp,
        templateName: bookingMessages.ownerNotification.templateName.trim(),
        contentVariables,
        kind: "owner_notification",
        smsType: "custom",
        note: "owner",
      });
    }

    const reminderTemplate =
      bookingMessages.appointmentReminder.templateName.trim();
    if (bookingMessages.appointmentReminder.enabled && reminderTemplate) {
      const appointmentStart = jerusalemWallClockToUtc(
        appointment.appointmentDate,
        appointment.appointmentTime,
      );
      const hoursBefore = Math.max(
        1,
        Math.min(168, bookingMessages.appointmentReminder.hoursBefore || 24),
      );

      if (!appointmentStart) {
        console.error("[WhatsApp] reminder skipped — invalid appointment time", {
          appointmentId: appointment.id,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
        });
      } else {
        const sendAt = new Date(
          appointmentStart.getTime() - hoursBefore * 60 * 60 * 1000,
        );
        await sendConfiguredTemplate(appointment, {
          to: appointment.phone,
          templateName: reminderTemplate,
          contentVariables,
          kind: "appointment_reminder",
          smsType: "appointment_reminder",
          sendAt,
          note: `${hoursBefore}h before`,
        });
      }
    }
  } catch (error) {
    console.error("[WhatsApp] dispatch failed", {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : "dispatch failed",
    });
  }
}
