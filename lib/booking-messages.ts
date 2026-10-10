import type {
  BookingMessagesSettings,
  CustomerConfirmationMode,
} from "@/lib/types";
import { normalizeIsraeliPhone } from "@/lib/israeli-phone";
import { sanitizeTwilioContentSid } from "@/lib/twilio/content-sid-format";

export const BOOKING_MESSAGE_PLACEHOLDERS = [
  "{{name}}",
  "{{service}}",
  "{{date}}",
  "{{time}}",
  "{{phone}}",
] as const;

export type BookingMessagePlaceholderValues = {
  name: string;
  service: string;
  date: string;
  time: string;
  phone: string;
};

export const DEFAULT_CUSTOMER_CONFIRMATION_BODY = `مرحباً {{name}} 👋

تم تأكيد حجزك في OYON Optics | عيون אופטיקה

👓 الخدمة: {{service}}
📅 التاريخ: {{date}}
🕐 الساعة: {{time}}

نتطلع لرؤيتك 🤍`;

export const DEFAULT_OWNER_NOTIFICATION_BODY = `🔔 حجز جديد | OYON Optics

👤 الزبون: {{name}}
👓 الخدمة: {{service}}
📅 التاريخ: {{date}}
🕐 الساعة: {{time}}
📱 الهاتف: {{phone}}`;

export const DEFAULT_APPOINTMENT_REMINDER_BODY = `⏰ تذكير بموعدك | OYON Optics

مرحباً {{name}}

نذكرك بموعدك القادم:

👓 الخدمة: {{service}}
📅 التاريخ: {{date}}
🕐 الساعة: {{time}}

ننتظرك 🤍`;

export const DEFAULT_BOOKING_MESSAGES: BookingMessagesSettings = {
  provider: "meta",
  customerConfirmation: {
    enabled: true,
    templateName: "oyon_booking_confirmation_hx716fcfd9ac41ae0e332e569b9b4fbc39",
    body: DEFAULT_CUSTOMER_CONFIRMATION_BODY,
    confirmationMode: "original",
    manageTemplateName: "oyon_booking_manage_v2_ar",
    manageTemplateEnabled: false,
    manageTemplateContentSid: "",
  },
  ownerNotification: {
    enabled: false,
    ownerWhatsApp: "",
    templateName: "",
    body: DEFAULT_OWNER_NOTIFICATION_BODY,
    testDestinationEnabled: false,
    testWhatsApp: "",
  },
  appointmentReminder: {
    enabled: false,
    minutesBefore: 60,
    templateName: "",
    body: DEFAULT_APPOINTMENT_REMINDER_BODY,
  },
};

type LegacyAppointmentReminder = Partial<
  BookingMessagesSettings["appointmentReminder"]
> & {
  hoursBefore?: number;
};

function resolveMinutesBefore(raw?: LegacyAppointmentReminder | null): number {
  if (
    raw &&
    typeof raw.minutesBefore === "number" &&
    Number.isFinite(raw.minutesBefore)
  ) {
    return raw.minutesBefore;
  }
  if (
    raw &&
    typeof raw.hoursBefore === "number" &&
    Number.isFinite(raw.hoursBefore)
  ) {
    return raw.hoursBefore * 60;
  }
  return DEFAULT_BOOKING_MESSAGES.appointmentReminder.minutesBefore;
}

function withDefaultBody(body: string | undefined, fallback: string): string {
  const trimmed = typeof body === "string" ? body.trim() : "";
  return trimmed || fallback;
}

export function customerConfirmationMode(
  settings?: Partial<BookingMessagesSettings> | null,
): CustomerConfirmationMode {
  return settings?.customerConfirmation?.confirmationMode === "new"
    ? "new"
    : "original";
}

function storedOwnerPhone(value?: string | null): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  return normalizeIsraeliPhone(trimmed) || trimmed;
}

export function resolveOwnerNotificationDestination(
  settings:
    | BookingMessagesSettings
    | BookingMessagesSettings["ownerNotification"],
): {
  to: string;
  source: "business" | "test";
} | {
  to: "";
  source: "missing";
} {
  const owner =
    "ownerNotification" in settings
      ? settings.ownerNotification
      : settings;
  const testEnabled = owner.testDestinationEnabled === true;
  const testTo = storedOwnerPhone(owner.testWhatsApp);
  if (testEnabled) {
    if (testTo && normalizeIsraeliPhone(testTo)) {
      return { to: testTo, source: "test" };
    }
    return { to: "", source: "missing" };
  }
  const business = storedOwnerPhone(owner.ownerWhatsApp);
  if (business && normalizeIsraeliPhone(business)) {
    return { to: business, source: "business" };
  }
  return { to: "", source: "missing" };
}

/** Mask a WhatsApp number for Admin display. Never used as a send destination. */
export function maskWhatsAppDestination(value?: string | null): string {
  const normalized = storedOwnerPhone(value);
  if (!normalized) return "";
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 6) return "••••";
  return `+${digits.slice(0, 3)}••••${digits.slice(-4)}`;
}

export type OwnerNotificationPatch = Partial<
  BookingMessagesSettings["ownerNotification"]
>;

/**
 * Merge owner-notification fields without letting test mode overwrite the
 * saved business number. Clearing ownerWhatsApp while test mode is on is ignored.
 */
export function mergeOwnerNotification(
  current?: BookingMessagesSettings["ownerNotification"] | null,
  patch?: OwnerNotificationPatch | null,
): BookingMessagesSettings["ownerNotification"] {
  const base = {
    ...DEFAULT_BOOKING_MESSAGES.ownerNotification,
    ...(current || {}),
  };
  const next = {
    ...base,
    ...(patch || {}),
  };
  const testDestinationEnabled = next.testDestinationEnabled === true;
  const incomingBusiness =
    patch && Object.prototype.hasOwnProperty.call(patch, "ownerWhatsApp")
      ? storedOwnerPhone(patch.ownerWhatsApp)
      : storedOwnerPhone(base.ownerWhatsApp);
  const preservedBusiness = storedOwnerPhone(base.ownerWhatsApp);
  const ownerWhatsApp =
    testDestinationEnabled && !incomingBusiness
      ? preservedBusiness
      : incomingBusiness;

  return {
    ...next,
    body: withDefaultBody(next.body, DEFAULT_OWNER_NOTIFICATION_BODY),
    ownerWhatsApp,
    testDestinationEnabled,
    testWhatsApp: storedOwnerPhone(next.testWhatsApp),
  };
}

export function mergeBookingMessages(
  partial?: Partial<BookingMessagesSettings> | null,
): BookingMessagesSettings {
  const provider =
    partial?.provider === "twilio" ? "meta" : partial?.provider;

  const customerConfirmation = {
    ...DEFAULT_BOOKING_MESSAGES.customerConfirmation,
    ...(partial?.customerConfirmation || {}),
  };
  const ownerNotification = mergeOwnerNotification(
    partial?.ownerNotification,
    null,
  );
  const rawAppointmentReminder = (partial?.appointmentReminder ||
    {}) as LegacyAppointmentReminder;
  const appointmentReminder = {
    ...DEFAULT_BOOKING_MESSAGES.appointmentReminder,
    ...rawAppointmentReminder,
    minutesBefore: resolveMinutesBefore(rawAppointmentReminder),
  };

  return {
    ...DEFAULT_BOOKING_MESSAGES,
    ...(partial || {}),
    provider: provider || DEFAULT_BOOKING_MESSAGES.provider,
    customerConfirmation: {
      ...customerConfirmation,
      body: withDefaultBody(
        customerConfirmation.body,
        DEFAULT_CUSTOMER_CONFIRMATION_BODY,
      ),
      confirmationMode: customerConfirmationMode({ customerConfirmation }),
      manageTemplateName:
        customerConfirmation.manageTemplateName?.trim() ||
        DEFAULT_BOOKING_MESSAGES.customerConfirmation.manageTemplateName,
      manageTemplateEnabled: customerConfirmation.manageTemplateEnabled === true,
      manageTemplateContentSid:
        sanitizeTwilioContentSid(customerConfirmation.manageTemplateContentSid) ||
        "",
    },
    ownerNotification,
    appointmentReminder: {
      enabled: appointmentReminder.enabled,
      minutesBefore: appointmentReminder.minutesBefore,
      templateName: appointmentReminder.templateName,
      body: withDefaultBody(
        appointmentReminder.body,
        DEFAULT_APPOINTMENT_REMINDER_BODY,
      ),
    },
  };
}

/** Replace {{name}} {{service}} {{date}} {{time}} {{phone}} in a stored template. */
export function applyBookingMessagePlaceholders(
  template: string,
  values: BookingMessagePlaceholderValues,
): string {
  return template
    .replaceAll("{{name}}", values.name)
    .replaceAll("{{service}}", values.service)
    .replaceAll("{{date}}", values.date)
    .replaceAll("{{time}}", values.time)
    .replaceAll("{{phone}}", values.phone)
    .trim();
}

/** Approved WhatsApp template names (Meta). Extend via env on the server. */
export function getApprovedWhatsAppTemplates(): string[] {
  const raw =
    process.env.WHATSAPP_APPROVED_TEMPLATES ||
    process.env.WHATSAPP_TEMPLATE_NAME ||
    process.env.TWILIO_WHATSAPP_APPROVED_TEMPLATES ||
    DEFAULT_BOOKING_MESSAGES.customerConfirmation.templateName;
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}
