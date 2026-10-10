import { pushSmsLog } from "@/lib/api/helpers";
import {
  customerConfirmationMode,
  mergeBookingMessages,
  resolveOwnerNotificationDestination,
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
import { sanitizeTwilioContentSid } from "@/lib/twilio/content-sid-format";
import {
  sendTwilioWhatsAppTemplate,
  type TwilioWhatsAppSendResult,
} from "@/lib/twilio/whatsapp";
import {
  buildManageTemplateContentVariables,
  CUSTOMER_MANAGE_TEMPLATE_NAME_AR,
  CUSTOMER_MANAGE_TEMPLATE_NAME_HE,
  OWNER_CANCELLED_TEMPLATE_NAME,
  OWNER_RESCHEDULED_TEMPLATE_NAME,
} from "@/lib/booking-manage-token";
import { isBookingE2EIsolated, recordE2EOutbound } from "@/lib/booking-e2e";
import { shouldSkipBookingWhatsApp } from "@/lib/booking-manage-test";
import { isSilentManageTestAppointment } from "@/lib/booking-silent-test";
import {
  formatPhoneForWhatsAppWeb,
  isWhatsAppWebServiceConfigured,
  logWhatsAppBookingResult,
  sendBookingWhatsAppMessage,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/provider";

export const LIVE_CUSTOMER_CONFIRMATION_TEMPLATE =
  "oyon_booking_confirmation_hx716fcfd9ac41ae0e332e569b9b4fbc39";
export const OWNER_NOTIFICATION_TEMPLATE = "owner_notification";
export const APPOINTMENT_REMINDER_TEMPLATE = "appointment_reminder";
export const OWNER_RESCHEDULED_TEMPLATE = OWNER_RESCHEDULED_TEMPLATE_NAME;
export const OWNER_CANCELLED_TEMPLATE = OWNER_CANCELLED_TEMPLATE_NAME;
const CUSTOMER_CONFIRMATION_TEMPLATE = LIVE_CUSTOMER_CONFIRMATION_TEMPLATE;

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

export function resolveManageTemplateName(
  bookingMessages: BookingMessagesSettings,
  language?: string | null,
): string {
  if (language === "he") return CUSTOMER_MANAGE_TEMPLATE_NAME_HE;
  if (language === "ar") return CUSTOMER_MANAGE_TEMPLATE_NAME_AR;
  return (
    bookingMessages.customerConfirmation.manageTemplateName?.trim() ||
    CUSTOMER_MANAGE_TEMPLATE_NAME_AR
  );
}

export function resolveManageTemplateContentSid(
  bookingMessages: BookingMessagesSettings,
  language?: string | null,
): string | null {
  const manageName = resolveManageTemplateName(bookingMessages, language);
  const mapped = resolveTwilioContentSid(manageName);
  if (mapped) return mapped;
  if (language === "he") return null;
  return sanitizeTwilioContentSid(
    bookingMessages.customerConfirmation.manageTemplateContentSid,
  );
}

export type CustomerConfirmationPlan = {
  mode: "original" | "new";
  templateName: string;
  useManageTemplate: boolean;
  contentSid: string | null;
  skipReason: "disabled" | "missing-sid" | "missing-token" | null;
};

export function resolveCustomerConfirmationTemplate(
  bookingMessages: BookingMessagesSettings,
  language?: string | null,
  manageToken?: string | null,
): CustomerConfirmationPlan {
  const mode = customerConfirmationMode(bookingMessages);
  const original = {
    mode,
    templateName: CUSTOMER_CONFIRMATION_TEMPLATE,
    useManageTemplate: false as const,
    contentSid: resolveTwilioContentSid(CUSTOMER_CONFIRMATION_TEMPLATE),
    skipReason: null as "disabled" | "missing-sid" | "missing-token" | null,
  };

  if (!bookingMessages.customerConfirmation.enabled) {
    return { ...original, skipReason: "disabled" };
  }

  if (language === "en" || mode !== "new") {
    return original;
  }

  const manageName = resolveManageTemplateName(bookingMessages, language);
  const contentSid = resolveManageTemplateContentSid(bookingMessages, language);
  if (!contentSid) {
    return {
      mode,
      templateName: manageName,
      useManageTemplate: false,
      contentSid: null,
      skipReason: "missing-sid",
    };
  }
  if (!manageToken) {
    return {
      mode,
      templateName: manageName,
      useManageTemplate: false,
      contentSid,
      skipReason: "missing-token",
    };
  }
  return {
    mode,
    templateName: manageName,
    useManageTemplate: true,
    contentSid,
    skipReason: null,
  };
}

/**
 * At most one customer confirmation. Never returns both original and new.
 * New-mode SID/token gaps skip instead of falling back after a send attempt.
 */
export function planCustomerConfirmationSend(
  bookingMessages: BookingMessagesSettings,
  language?: string | null,
  manageToken?: string | null,
): CustomerConfirmationPlan[] {
  const plan = resolveCustomerConfirmationTemplate(
    bookingMessages,
    language,
    manageToken,
  );
  return plan.skipReason ? [] : [plan];
}

export function customerConfirmationAlreadySent(
  store: AppData,
  appointmentId: string,
): boolean {
  return store.smsLogs.some(
    (log) =>
      log.appointmentId === appointmentId &&
      log.type === "appointment_confirmation" &&
      (log.status === "sent" || log.status === "queued") &&
      log.body.startsWith("WhatsApp:"),
  );
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

export function buildOwnerRescheduleContentVariables(opts: {
  customerName: string;
  customerPhone: string;
  serviceLabel: string;
  originalDateLabel: string;
  originalTime: string;
  newDateLabel: string;
  newTime: string;
}): Record<string, string> {
  return {
    "1": opts.customerName,
    "2": opts.customerPhone,
    "3": opts.serviceLabel,
    "4": opts.originalDateLabel,
    "5": opts.originalTime,
    "6": opts.newDateLabel,
    "7": opts.newTime,
  };
}

export function buildOwnerCancelContentVariables(opts: {
  customerName: string;
  dateLabel: string;
  time: string;
  customerPhone: string;
  serviceLabel: string;
}): Record<string, string> {
  return {
    "1": opts.customerName,
    "2": opts.dateLabel,
    "3": opts.time,
    "4": opts.customerPhone,
    "5": opts.serviceLabel,
  };
}

export function ownerRescheduleDedupNote(
  originalDate: string,
  originalTime: string,
  newDate: string,
  newTime: string,
): string {
  return `owner-reschedule:${originalDate} ${originalTime}->${newDate} ${newTime}`;
}

export function ownerCancelDedupNote(date: string, time: string): string {
  return `owner-cancel:${date} ${time}`;
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

export function ownerLifecycleAlreadySent(
  store: AppData,
  appointmentId: string,
  type: "appointment_rescheduled" | "appointment_cancellation",
  note: string,
): boolean {
  const marker = `(${note})`;
  return store.smsLogs.some(
    (log) =>
      log.appointmentId === appointmentId &&
      log.type === type &&
      (log.status === "sent" || log.status === "queued") &&
      log.body.includes(marker),
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
    type:
      | "appointment_confirmation"
      | "appointment_reminder"
      | "appointment_rescheduled"
      | "appointment_cancellation"
      | "custom";
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
  const destination = resolveOwnerNotificationDestination(bookingMessages);
  if (destination.source === "missing" || !destination.to) {
    return "missing-owner-phone";
  }
  if (!formatPhoneForWhatsAppWeb(destination.to)) {
    return "invalid-owner-phone";
  }
  void useWhatsAppWeb;
  if (!resolveTwilioContentSid(OWNER_NOTIFICATION_TEMPLATE)) {
    return "missing-template";
  }
  return null;
}

export function ownerLifecycleSkipReason(
  bookingMessages: BookingMessagesSettings,
  templateName: string,
):
  | "disabled"
  | "missing-owner-phone"
  | "invalid-owner-phone"
  | "missing-template"
  | null {
  if (!bookingMessages.ownerNotification.enabled) {
    return "disabled";
  }
  const destination = resolveOwnerNotificationDestination(bookingMessages);
  if (destination.source === "missing" || !destination.to) {
    return "missing-owner-phone";
  }
  if (!formatPhoneForWhatsAppWeb(destination.to)) {
    return "invalid-owner-phone";
  }
  if (!resolveTwilioContentSid(templateName)) {
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
    contentSid?: string | null;
    kind:
      | "customer_confirmation"
      | "owner_notification"
      | "appointment_reminder"
      | "owner_reschedule"
      | "owner_cancel";
    smsType:
      | "appointment_confirmation"
      | "appointment_reminder"
      | "appointment_rescheduled"
      | "appointment_cancellation"
      | "custom";
    note?: string;
  },
): Promise<void> {
  const result = await sendTwilioWhatsAppTemplate({
    to: opts.to,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
    contentSid: opts.contentSid,
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
    contentSid?: string | null;
  },
): Promise<void> {
  await sendViaTwilio(appointment, {
    to: appointment.phone,
    templateName: opts.templateName,
    contentVariables: opts.contentVariables,
    contentSid: opts.contentSid,
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
    kind:
      | "customer_confirmation"
      | "owner_notification"
      | "appointment_reminder";
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
export function shouldDispatchBookingMessages(
  appointment: EyeExamAppointment,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (isSilentManageTestAppointment(appointment)) return false;
  if (shouldSkipBookingWhatsApp(vercelEnv, nodeEnv)) return false;
  return true;
}

export async function dispatchBookingMessages(
  appointment: EyeExamAppointment,
  opts?: { manageToken?: string },
): Promise<void> {
  try {
    if (isBookingE2EIsolated()) {
      recordE2EOutbound("whatsapp", appointment.id);
      return;
    }
    if (isSilentManageTestAppointment(appointment)) {
      console.info("[WhatsApp] skipped — silent admin manage test", {
        appointmentId: appointment.id,
      });
      return;
    }
    if (!shouldDispatchBookingMessages(appointment)) {
      console.info("[WhatsApp] skipped — Preview/dev test environment", {
        appointmentId: appointment.id,
      });
      return;
    }

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
    const alreadySentConfirmation = customerConfirmationAlreadySent(
      store,
      appointment.id,
    );
    const confirmationSends = alreadySentConfirmation
      ? []
      : planCustomerConfirmationSend(
          bookingMessages,
          appointment.language,
          opts?.manageToken,
        );
    const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
    const dateLabel = formatEyeExamDateDisplay(appointment.appointmentDate);
    const useWhatsAppWeb = isWhatsAppWebServiceConfigured();
    const immediateSends: Promise<void>[] = [];

    if (confirmationSends.length === 0) {
      const skipped = resolveCustomerConfirmationTemplate(
        bookingMessages,
        appointment.language,
        opts?.manageToken,
      );
      console.info("[WhatsApp] customer confirmation skipped", {
        appointmentId: appointment.id,
        reason: alreadySentConfirmation ? "already-sent" : skipped.skipReason,
        mode: skipped.mode,
        template: skipped.templateName,
      });
    } else {
      const confirmation = confirmationSends[0]!;
      const customerConfirmationVariables = confirmation.useManageTemplate
        ? buildManageTemplateContentVariables({
            customerName,
            serviceLabel,
            dateLabel,
            time: appointment.appointmentTime,
            token: opts!.manageToken!,
          })
        : buildCustomerConfirmationContentVariables(appointment);
      immediateSends.push(
        sendCustomerConfirmationViaTwilio(appointment, {
          templateName: confirmation.templateName,
          contentVariables: customerConfirmationVariables,
          contentSid: confirmation.useManageTemplate
            ? confirmation.contentSid
            : undefined,
        }),
      );
    }

    const ownerDestination = resolveOwnerNotificationDestination(bookingMessages);
    const ownerSkip = ownerNotificationSkipReason(
      bookingMessages,
      useWhatsAppWeb,
    );
    if (ownerSkip) {
      console.info("[WhatsApp] owner notification skipped", {
        appointmentId: appointment.id,
        reason: ownerSkip,
        destination: ownerDestination.source,
        hasTemplate: Boolean(OWNER_NOTIFICATION_TEMPLATE),
        templateName: OWNER_NOTIFICATION_TEMPLATE,
        useWhatsAppWeb,
      });
    } else {
      immediateSends.push(
        sendViaTwilio(appointment, {
          to: ownerDestination.to,
          templateName: OWNER_NOTIFICATION_TEMPLATE,
          contentVariables: ownerContentVariables,
          kind: "owner_notification",
          smsType: "custom",
          note: ownerDestination.source === "test" ? "owner-test" : "owner",
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

async function loadLiveBookingMessages(): Promise<{
  store: AppData;
  bookingMessages: ReturnType<typeof mergeBookingMessages>;
} | null> {
  if (isBookingE2EIsolated()) return null;
  invalidateStoreCache();
  const { data: store } = await getStore();
  const bookingMessages = mergeBookingMessages(store.settings.bookingMessages);
  if (bookingMessages.provider === "console" || bookingMessages.provider !== "meta") {
    return null;
  }
  return { store, bookingMessages };
}

/**
 * Owner WhatsApp after a customer reschedule. Never sends a customer message.
 * Dedupes retries of the same original→new slot.
 */
export async function dispatchOwnerRescheduleNotification(
  appointment: EyeExamAppointment,
  opts: {
    originalDate: string;
    originalTime: string;
    serviceLabel: string;
  },
): Promise<boolean> {
  try {
    if (!shouldDispatchBookingMessages(appointment)) return false;
    const loaded = await loadLiveBookingMessages();
    if (!loaded) return false;

    const note = ownerRescheduleDedupNote(
      opts.originalDate,
      opts.originalTime,
      appointment.appointmentDate,
      appointment.appointmentTime,
    );
    if (
      ownerLifecycleAlreadySent(
        loaded.store,
        appointment.id,
        "appointment_rescheduled",
        note,
      )
    ) {
      console.info("[WhatsApp] owner reschedule skipped — already sent", {
        appointmentId: appointment.id,
      });
      return false;
    }

    const skip = ownerLifecycleSkipReason(
      loaded.bookingMessages,
      OWNER_RESCHEDULED_TEMPLATE,
    );
    if (skip) {
      console.info("[WhatsApp] owner reschedule skipped", {
        appointmentId: appointment.id,
        reason: skip,
      });
      return false;
    }

    const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
    const destination = resolveOwnerNotificationDestination(loaded.bookingMessages);
    await sendViaTwilio(appointment, {
      to: destination.to,
      templateName: OWNER_RESCHEDULED_TEMPLATE,
      contentVariables: buildOwnerRescheduleContentVariables({
        customerName,
        customerPhone: appointment.phone,
        serviceLabel: opts.serviceLabel,
        originalDateLabel: formatEyeExamDateDisplay(opts.originalDate),
        originalTime: opts.originalTime,
        newDateLabel: formatEyeExamDateDisplay(appointment.appointmentDate),
        newTime: appointment.appointmentTime,
      }),
      kind: "owner_reschedule",
      smsType: "appointment_rescheduled",
      note,
    });
    return true;
  } catch (error) {
    console.error("[WhatsApp] owner reschedule dispatch failed", {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : "dispatch failed",
    });
    return false;
  }
}

/**
 * Owner WhatsApp after a customer cancel. Uses the booking details from
 * immediately before cancellation. Does not send a customer-facing cancel message.
 */
export async function dispatchOwnerCancelNotification(
  appointment: EyeExamAppointment,
  opts: { serviceLabel: string },
): Promise<boolean> {
  try {
    if (!shouldDispatchBookingMessages(appointment)) return false;
    const loaded = await loadLiveBookingMessages();
    if (!loaded) return false;

    const note = ownerCancelDedupNote(
      appointment.appointmentDate,
      appointment.appointmentTime,
    );
    if (
      ownerLifecycleAlreadySent(
        loaded.store,
        appointment.id,
        "appointment_cancellation",
        note,
      )
    ) {
      console.info("[WhatsApp] owner cancel skipped — already sent", {
        appointmentId: appointment.id,
      });
      return false;
    }

    const skip = ownerLifecycleSkipReason(
      loaded.bookingMessages,
      OWNER_CANCELLED_TEMPLATE,
    );
    if (skip) {
      console.info("[WhatsApp] owner cancel skipped", {
        appointmentId: appointment.id,
        reason: skip,
      });
      return false;
    }

    const destination = resolveOwnerNotificationDestination(loaded.bookingMessages);
    const customerName = `${appointment.firstName} ${appointment.lastName}`.trim();
    await sendViaTwilio(appointment, {
      to: destination.to,
      templateName: OWNER_CANCELLED_TEMPLATE,
      contentVariables: buildOwnerCancelContentVariables({
        customerName,
        dateLabel: formatEyeExamDateDisplay(appointment.appointmentDate),
        time: appointment.appointmentTime,
        customerPhone: appointment.phone,
        serviceLabel: opts.serviceLabel,
      }),
      kind: "owner_cancel",
      smsType: "appointment_cancellation",
      note,
    });
    return true;
  } catch (error) {
    console.error("[WhatsApp] owner cancel dispatch failed", {
      appointmentId: appointment.id,
      error: error instanceof Error ? error.message : "dispatch failed",
    });
    return false;
  }
}

/** Send due appointment reminders (Meta has no native schedule API). */
export async function processDueAppointmentReminders(): Promise<{
  checked: number;
  sent: number;
}> {
  if (shouldSkipBookingWhatsApp()) {
    return { checked: 0, sent: 0 };
  }

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
    if (isSilentManageTestAppointment(appointment)) continue;
    const didSend = await sendAppointmentReminder(
      appointment,
      store,
      bookingMessages,
    );
    if (didSend) sent += 1;
  }

  return { checked: appointments.length, sent };
}
