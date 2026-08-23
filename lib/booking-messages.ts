import type { BookingMessagesSettings } from "@/lib/types";

export const DEFAULT_BOOKING_MESSAGES: BookingMessagesSettings = {
  provider: "twilio",
  customerConfirmation: {
    enabled: true,
    templateName: "hello_world",
  },
  ownerNotification: {
    enabled: false,
    ownerWhatsApp: "",
    templateName: "",
  },
  appointmentReminder: {
    enabled: false,
    hoursBefore: 24,
    templateName: "",
  },
};

export function mergeBookingMessages(
  partial?: Partial<BookingMessagesSettings> | null,
): BookingMessagesSettings {
  return {
    ...DEFAULT_BOOKING_MESSAGES,
    ...(partial || {}),
    customerConfirmation: {
      ...DEFAULT_BOOKING_MESSAGES.customerConfirmation,
      ...(partial?.customerConfirmation || {}),
    },
    ownerNotification: {
      ...DEFAULT_BOOKING_MESSAGES.ownerNotification,
      ...(partial?.ownerNotification || {}),
    },
    appointmentReminder: {
      ...DEFAULT_BOOKING_MESSAGES.appointmentReminder,
      ...(partial?.appointmentReminder || {}),
    },
  };
}

/** Approved WhatsApp template names (Twilio / Meta). Extend via env on the server. */
export function getApprovedWhatsAppTemplates(): string[] {
  const raw =
    process.env.TWILIO_WHATSAPP_APPROVED_TEMPLATES ||
    process.env.WHATSAPP_TEMPLATE_NAME ||
    "hello_world";
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}
