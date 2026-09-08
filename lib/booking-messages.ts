import type { BookingMessagesSettings } from "@/lib/types";

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
  },
  ownerNotification: {
    enabled: false,
    ownerWhatsApp: "",
    templateName: "",
    body: DEFAULT_OWNER_NOTIFICATION_BODY,
  },
  appointmentReminder: {
    enabled: false,
    hoursBefore: 24,
    templateName: "",
    body: DEFAULT_APPOINTMENT_REMINDER_BODY,
  },
};

function withDefaultBody(body: string | undefined, fallback: string): string {
  const trimmed = typeof body === "string" ? body.trim() : "";
  return trimmed || fallback;
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
  const ownerNotification = {
    ...DEFAULT_BOOKING_MESSAGES.ownerNotification,
    ...(partial?.ownerNotification || {}),
  };
  const appointmentReminder = {
    ...DEFAULT_BOOKING_MESSAGES.appointmentReminder,
    ...(partial?.appointmentReminder || {}),
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
    },
    ownerNotification: {
      ...ownerNotification,
      body: withDefaultBody(
        ownerNotification.body,
        DEFAULT_OWNER_NOTIFICATION_BODY,
      ),
    },
    appointmentReminder: {
      ...appointmentReminder,
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
