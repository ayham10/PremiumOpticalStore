import { pushSmsLog } from "@/lib/api/helpers";
import {
  applyBookingMessagePlaceholders,
  DEFAULT_APPOINTMENT_REMINDER_BODY,
  DEFAULT_OWNER_NOTIFICATION_BODY,
  mergeBookingMessages,
} from "@/lib/booking-messages";
import { pickLocalized } from "@/lib/booking-services";
import { getStore, invalidateStoreCache, updateStore } from "@/lib/db/store";
import {
  formatEyeExamDateDisplay,
  jerusalemWallClockToUtc,
} from "@/lib/eye-exam";
import type { SmsResult } from "@/lib/sms/provider";
import type { AppData, BookingMessagesSettings, EyeExamAppointment } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import {
  sendTwilioWhatsAppTemplate,
  type TwilioWhatsAppSendResult,
} from "@/lib/twilio/whatsapp";
import {
  formatPhoneForWhatsAppWeb,
  isWhatsAppWebServiceConfigured,
  logWhatsAppBookingResult,
  sendBookingWhatsAppMessage,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/provider";

const CUSTOMER_CONFIRMATION_TEMPLATE =
  "oyon_booking_confirmation_hx716fcfd9ac41ae0e332e569b9b4fbc39";

const REMINDER_GRACE_MS = 30 * 60 * 1000;

function buildCustomerConfirmationContentVariables(
  appointment: EyeExamAppointment,
): Record<string, string> {
  const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
  return {
    "1": customerName,
    "2": appointment.appointmentDate,
    "3": appointment.appointmentTime,
  };
}

function buildOwnerNotificationContentVariables(
  appointment: EyeExamAppointment,
  serviceLabel: string,
): Record<string, string> {
  const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
  const dateLabel = formatEyeExamDateDisplay(appointment.appointmentDate);

  return {
    "1": customerName,
    "2": dateLabel,
    "3": appointment.appointmentTime,
    "4": appointment.phone,
    "5": serviceLabel,
    customer_name: customerName,
    appointment_date: dateLabel,
    appointment_time: appointment.appointmentTime,
    customer_phone: appointment.phone,
    service_name: serviceLabel,
  };
}

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

function bookingPlaceholderValues(
  appointment: EyeExamAppointment,
  serviceLabel: string,
): {
  name: string;
  service: string;
  date: string;
  time: string;
  phone: string;
} {
  return {
    name: `${appointment.firstName} ${appointment.lastName}`.trim(),
    service: serviceLabel,
    date: formatEyeExamDateDisplay(appointment.appointmentDate),
    time: appointment.appointmentTime,
    phone: appointment.phone,
  };
}

function toSmsResult(
  result: WhatsAppSendResult | TwilioWhatsAppSendResult,
): SmsResult {
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

function reminderAlreadySent(store: AppData, appointmentId: string): boolean {
  return store.smsLogs.some(
    (log) =>
      log.appointmentId === appointmentId &&
      log.type === "appointment_reminder" &&
      log.status === "sent",
  );
}

function computeReminderSendAt(
  appointment: EyeExamAppointment,
  minutesBefore: number,
): Date | null {
  const appointmentStart = jerusalemWallClockToUtc(
    appointment.appointmentDate,
    appointment.appointmentTime,
  );
  if (!appointmentStart) return null;

  return new Date(appointmentStart.getTime() - minutesBefore * 60 * 1000);
}

function reminderMinutesBefore(
  bookingMessages: ReturnType<typeof mergeBookingMessages>,
): number {
  return Math.max(
    15,
    Math.min(120, bookingMessages.appointmentReminder.minutesBefore || 60),
  );
}

async function logWhatsAppAttempt(
  appointment: EyeExamAppointment,
  opts: {
    to: string;
    type: "appointment_confirmation" | "appointment_reminder" | "custom";
    templateName: string;
    result: WhatsAppSendResult | TwilioWhatsAppSendResult;
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

export function ownerNotificationSkipReason(
  bookingMessages: BookingMessagesSettings,
  useWhatsAppWeb: boolean,
):
  | "disabled"
  | "missing-owner-phone"
  | "invalid-owner-phone"
  | "missing-template"
  | null {
  if (!bookingMessages.ownerNotification.enabled) {
    return "disabled";
  }
  const ownerWhatsApp = bookingMessages.ownerNotification.ownerWhatsApp.trim();
  if (!ownerWhatsApp) {
    return "missing-owner-phone";
  }
  if (!formatPhoneForWhatsAppWeb(ownerWhatsApp)) {
    return "invalid-owner-phone";
  }
  if (!useWhatsAppWeb && !bookingMessages.ownerNotification.templateName.trim()) {
    return "missing-template";
  }
  return null;
}

async function sendCustomerConfirmationViaTwilio(
  appointment: EyeExamAppointment,
  opts: {
    templateName: string;
    contentVariables: Record<string, string>;
  },
): Promise<void> {
  const result = await sendTwilioWhatsAppTemplate({
    to: appointment.phone,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
  });

  if (result.ok) {
    console.info("[WhatsApp] customer confirmation sent", {
      appointmentId: appointment.id,
      provider: "twilio",
      template: result.templateName,
      messageId: result.externalId,
      status: result.status,
    });
  } else {
    console.error("[WhatsApp] customer confirmation failed", {
      appointmentId: appointment.id,
      provider: "twilio",
      template: result.templateName,
      status: result.status,
      error: result.error || "Twilio confirmation send failed",
    });
  }

  await logWhatsAppAttempt(appointment, {
    to: appointment.phone,
    type: "appointment_confirmation",
    templateName: opts.templateName,
    result,
  });
}

async function sendConfiguredTemplate(
  appointment: EyeExamAppointment,
  opts: {
    to: string;
    templateName: string;
    contentVariables: Record<string, string>;
    kind: "customer_confirmation" | "owner_notification" | "appointment_reminder";
    smsType: "appointment_confirmation" | "appointment_reminder" | "custom";
    textMessage: string;
    sendAt?: Date;
    note?: string;
    logDeferredReminder?: boolean;
  },
): Promise<void> {
  const result = await sendBookingWhatsAppMessage({
    to: opts.to,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
    sendAt: opts.sendAt,
    textMessage: opts.textMessage,
  });

  logWhatsAppBookingResult(result, {
    appointmentId: appointment.id,
    to: opts.to,
    kind: opts.kind,
  });

  if (result.status === "queued" && opts.sendAt && !opts.logDeferredReminder) {
    return;
  }

  await logWhatsAppAttempt(appointment, {
    to: opts.to,
    type: opts.smsType,
    templateName: opts.templateName,
    result,
    note: opts.note,
  });
}

async function sendAppointmentReminder(
  appointment: EyeExamAppointment,
  store: AppData,
  bookingMessages: ReturnType<typeof mergeBookingMessages>,
): Promise<boolean> {
  const reminderBody =
    bookingMessages.appointmentReminder.body.trim() ||
    DEFAULT_APPOINTMENT_REMINDER_BODY;
  const reminderTemplate = bookingMessages.appointmentReminder.templateName.trim();
  const useWhatsAppWeb = isWhatsAppWebServiceConfigured();
  if (
    reminderAlreadySent(store, appointment.id) ||
    (!useWhatsAppWeb && !reminderTemplate)
  ) {
    return false;
  }

  const minutesBefore = reminderMinutesBefore(bookingMessages);
  const sendAt = computeReminderSendAt(appointment, minutesBefore);
  if (!sendAt) {
    console.error("[WhatsApp] reminder skipped — invalid appointment time", {
      appointmentId: appointment.id,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
    });
    return false;
  }

  const now = Date.now();
  if (sendAt.getTime() > now + 60_000) {
    return false;
  }
  if (sendAt.getTime() + REMINDER_GRACE_MS < now) {
    return false;
  }

  const serviceLabel = resolveServiceLabel(
    appointment,
    store.bookingServices || [],
  );
  const contentVariables = buildBookingContentVariables(appointment, serviceLabel);
  const placeholders = bookingPlaceholderValues(appointment, serviceLabel);

  await sendConfiguredTemplate(appointment, {
    to: appointment.phone,
    templateName: reminderTemplate || "appointment_reminder",
    contentVariables,
    textMessage: applyBookingMessagePlaceholders(reminderBody, placeholders),
    kind: "appointment_reminder",
    smsType: "appointment_reminder",
    sendAt,
    note: `${minutesBefore}m before`,
    logDeferredReminder: true,
  });

  return true;
}

/**
 * Dispatch WhatsApp messages after a booking is saved.
 * Customer confirmation uses Twilio ContentSid templates.
 * Owner notification and reminders still use Oracle WhatsApp Web
 * when configured, otherwise Meta templates.
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
      console.info("[WhatsApp] console provider — skipping send", {
        appointmentId: appointment.id,
      });
      return;
    }

    if (bookingMessages.provider !== "meta") {
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
    const placeholders = bookingPlaceholderValues(appointment, serviceLabel);
    const contentVariables = buildBookingContentVariables(appointment, serviceLabel);
    const ownerContentVariables = buildOwnerNotificationContentVariables(
      appointment,
      serviceLabel,
    );
    const customerConfirmationVariables =
      buildCustomerConfirmationContentVariables(appointment);
    const useWhatsAppWeb = isWhatsAppWebServiceConfigured();
    const immediateSends: Promise<void>[] = [];

    if (bookingMessages.customerConfirmation.enabled) {
      immediateSends.push(
        sendCustomerConfirmationViaTwilio(appointment, {
          templateName: CUSTOMER_CONFIRMATION_TEMPLATE,
          contentVariables: customerConfirmationVariables,
        }),
      );
    }

    const ownerWhatsApp =
      bookingMessages.ownerNotification.ownerWhatsApp.trim();
    const ownerTemplate =
      bookingMessages.ownerNotification.templateName.trim();
    const ownerSkip = ownerNotificationSkipReason(
      bookingMessages,
      useWhatsAppWeb,
    );
    if (ownerSkip) {
      console.info("[WhatsApp] owner notification skipped", {
        appointmentId: appointment.id,
        reason: ownerSkip,
        hasOwnerPhone: Boolean(ownerWhatsApp),
        hasTemplate: Boolean(ownerTemplate),
        useWhatsAppWeb,
      });
    } else {
      immediateSends.push(
        sendConfiguredTemplate(appointment, {
          to: ownerWhatsApp,
          templateName: ownerTemplate || "owner_notification",
          contentVariables: ownerContentVariables,
          textMessage: applyBookingMessagePlaceholders(
            bookingMessages.ownerNotification.body ||
              DEFAULT_OWNER_NOTIFICATION_BODY,
            placeholders,
          ),
          kind: "owner_notification",
          smsType: "custom",
          note: "owner",
        }),
      );
    }

    await Promise.all(immediateSends);

    if (bookingMessages.appointmentReminder.enabled) {
      const minutesBefore = reminderMinutesBefore(bookingMessages);
      const sendAt = computeReminderSendAt(appointment, minutesBefore);

      if (!sendAt) {
        console.error("[WhatsApp] reminder skipped — invalid appointment time", {
          appointmentId: appointment.id,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime,
        });
      } else if (sendAt.getTime() <= Date.now() + 60_000) {
        await sendAppointmentReminder(appointment, store, bookingMessages);
      } else {
        console.info("[WhatsApp] reminder scheduled for later delivery", {
          appointmentId: appointment.id,
          sendAt: sendAt.toISOString(),
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

/** Send due appointment reminders (Meta has no native schedule API). */
export async function processDueAppointmentReminders(): Promise<{
  checked: number;
  sent: number;
}> {
  invalidateStoreCache();
  const { data: store } = await getStore();
  const bookingMessages = mergeBookingMessages(store.settings.bookingMessages);

  if (
    bookingMessages.provider !== "meta" ||
    !bookingMessages.appointmentReminder.enabled
  ) {
    return { checked: 0, sent: 0 };
  }

  let sent = 0;
  const appointments = store.eyeExamAppointments || [];
  for (const appointment of appointments) {
    if (appointment.status !== "confirmed") continue;
    const didSend = await sendAppointmentReminder(
      appointment,
      store,
      bookingMessages,
    );
    if (didSend) sent += 1;
  }

  return { checked: appointments.length, sent };
}
