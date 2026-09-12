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
  getTwilioContentSidMap,
  resolveTwilioContentSid,
} from "@/lib/twilio/content-sids";
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
const OWNER_NOTIFICATION_TEMPLATE = "owner_notification";
const APPOINTMENT_REMINDER_TEMPLATE = "appointment_reminder";

const REMINDER_GRACE_MS = 30 * 60 * 1000;

function firstMappedTwilioTemplate(...needles: string[]): string | null {
  const lowerNeedles = needles.map((needle) => needle.toLowerCase());
  for (const name of getTwilioContentSidMap().keys()) {
    const lower = name.toLowerCase();
    if (lowerNeedles.every((needle) => lower.includes(needle))) {
      return name;
    }
  }
  return null;
}

/** Prefer a name that already has a ContentSid mapping (avoids short Admin aliases). */
function resolveMappedTwilioTemplateName(
  storedName: string,
  needles: string[],
  fallback: string,
): string {
  const requested = storedName.trim();
  if (requested && resolveTwilioContentSid(requested)) {
    return requested;
  }
  return firstMappedTwilioTemplate(...needles) || fallback;
}

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
      (log.status === "sent" || log.status === "queued"),
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
  void useWhatsAppWeb;
  const ownerTemplate = resolveMappedTwilioTemplateName(
    bookingMessages.ownerNotification.templateName,
    ["owner"],
    OWNER_NOTIFICATION_TEMPLATE,
  );
  if (!resolveTwilioContentSid(ownerTemplate)) {
    return "missing-template";
  }
  return null;
}

async function sendViaTwilio(
  appointment: EyeExamAppointment,
  opts: {
    to: string;
    templateName: string;
    contentVariables: Record<string, string>;
    kind: "customer_confirmation" | "owner_notification" | "appointment_reminder";
    smsType: "appointment_confirmation" | "appointment_reminder" | "custom";
    note?: string;
  },
): Promise<void> {
  const result = await sendTwilioWhatsAppTemplate({
    to: opts.to,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
  });

  if (result.ok) {
    console.info(`[WhatsApp] ${opts.kind} sent`, {
      appointmentId: appointment.id,
      provider: "twilio",
      template: result.templateName,
      messageId: result.externalId,
      status: result.status,
    });
  } else {
    console.error(`[WhatsApp] ${opts.kind} failed`, {
      appointmentId: appointment.id,
      provider: "twilio",
      template: result.templateName,
      status: result.status,
      error: result.error || "Twilio send failed",
    });
  }

  await logWhatsAppAttempt(appointment, {
    to: opts.to,
    type: opts.smsType,
    templateName: opts.templateName,
    result,
    note: opts.note,
  });
}

async function sendCustomerConfirmationViaTwilio(
  appointment: EyeExamAppointment,
  opts: {
    templateName: string;
    contentVariables: Record<string, string>;
  },
): Promise<void> {
  await sendViaTwilio(appointment, {
    to: appointment.phone,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
    kind: "customer_confirmation",
    smsType: "appointment_confirmation",
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
  const reminderTemplate = resolveMappedTwilioTemplateName(
    bookingMessages.appointmentReminder.templateName,
    ["remind"],
    APPOINTMENT_REMINDER_TEMPLATE,
  );
  if (reminderAlreadySent(store, appointment.id)) {
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

  await sendViaTwilio(appointment, {
    to: appointment.phone,
    templateName: reminderTemplate,
    contentVariables,
    kind: "appointment_reminder",
    smsType: "appointment_reminder",
    note: `${minutesBefore}m before`,
  });

  return true;
}

/**
 * Dispatch WhatsApp messages after a booking is saved.
 * Customer confirmation, owner notification, and reminders use Twilio
 * ContentSid templates. Oracle WhatsApp Web / Meta helpers remain in
 * sendConfiguredTemplate for future reuse and are not deleted.
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
    const ownerTemplate = resolveMappedTwilioTemplateName(
      bookingMessages.ownerNotification.templateName,
      ["owner"],
      OWNER_NOTIFICATION_TEMPLATE,
    );
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
        sendViaTwilio(appointment, {
          to: ownerWhatsApp,
          templateName: ownerTemplate,
          contentVariables: ownerContentVariables,
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
