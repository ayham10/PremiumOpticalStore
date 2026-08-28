import type { BookingMessagesSettings } from "@/lib/types";

export const DEFAULT_BOOKING_MESSAGES: BookingMessagesSettings = {
  provider: "meta",
  customerConfirmation: {
    enabled: true,
    templateName: "oyon_booking_confirmation_hx716fcfd9ac41ae0e332e569b9b4fbc39",
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
  const provider =
    partial?.provider === "twilio" ? "meta" : partial?.provider;

  return {
    ...DEFAULT_BOOKING_MESSAGES,
    ...(partial || {}),
    provider: provider || DEFAULT_BOOKING_MESSAGES.provider,
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
