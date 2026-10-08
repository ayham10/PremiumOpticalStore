import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOOKING_MANAGE_CTA_URL,
  EXPIRED_MANAGE_LINK_MESSAGE,
} from "../lib/booking-manage-constants";
import {
  bookingManageOriginFromRequest,
  isBookingManagePreviewTestAllowed,
  shouldSkipBookingWhatsApp,
} from "../lib/booking-manage-test";
import { bookingManageUrlForOrigin } from "../lib/booking-manage-token";
import {
  bookingManageUrl,
  bookingManageUrlParam,
  buildManageTemplateContentVariables,
  canCustomerMutateBooking,
  computeManageTokenExpiresAt,
  evaluateManageAccess,
  findAppointmentByManageTokenHash,
  generateBookingManageToken,
  hashBookingManageToken,
  issueBookingManageToken,
  manageAccessMessage,
  omitManageTokenSecrets,
  publicManageAppointmentView,
} from "../lib/booking-manage-token";
import { mergeBookingMessages } from "../lib/booking-messages";
import {
  APPOINTMENT_REMINDER_TEMPLATE,
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
  OWNER_NOTIFICATION_TEMPLATE,
  resolveCustomerConfirmationTemplate,
} from "../lib/booking-messaging";
import { formatEyeExamDateDisplay } from "../lib/eye-exam";
import { sanitizeTwilioContentSid } from "../lib/twilio/content-sid-format";
import { resetTwilioContentSidMapForTests } from "../lib/twilio/content-sids";
import type { EyeExamAppointment } from "../lib/types";

function appointment(
  overrides: Partial<EyeExamAppointment> &
    Pick<EyeExamAppointment, "id" | "firstName" | "lastName">,
): EyeExamAppointment {
  return {
    email: `${overrides.id}@example.com`,
    phone: "+972501111111",
    appointmentDate: "2026-10-15",
    appointmentTime: "10:30",
    appointmentType: "eye_exam",
    status: "confirmed",
    language: "ar",
    smsStatus: "pending",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function sampleHxSid(): string {
  return `HX${"b".repeat(32)}`;
}

resetTwilioContentSidMapForTests();
delete process.env.TWILIO_WHATSAPP_CONTENT_SIDS;

const issuedA = issueBookingManageToken("2026-10-15", "10:30", 30);
const issuedB = issueBookingManageToken("2026-10-15", "11:30", 30);
assert.notEqual(issuedA.token, issuedB.token);
assert.notEqual(issuedA.manageTokenHash, issuedB.manageTokenHash);
assert.equal(issuedA.manageTokenHash, hashBookingManageToken(issuedA.token));
assert.doesNotMatch(issuedA.manageTokenHash, /[^0-9a-f]/);
assert.equal(issuedA.manageTokenHash.length, 64);
assert.equal(issuedA.manageTokenRevokedAt, null);

const tokens = new Set<string>();
for (let i = 0; i < 40; i++) {
  tokens.add(generateBookingManageToken());
}
assert.equal(tokens.size, 40);

const customerA = appointment({
  id: "eea_a",
  firstName: "محمد",
  lastName: "علي",
  phone: "+972501111111",
  manageTokenHash: issuedA.manageTokenHash,
  manageTokenExpiresAt: issuedA.manageTokenExpiresAt,
  manageTokenRevokedAt: null,
});
const customerB = appointment({
  id: "eea_b",
  firstName: "سارة",
  lastName: "حسن",
  phone: "+972502222222",
  appointmentTime: "11:30",
  manageTokenHash: issuedB.manageTokenHash,
  manageTokenExpiresAt: issuedB.manageTokenExpiresAt,
  manageTokenRevokedAt: null,
});
const roster = [customerA, customerB];

assert.equal(findAppointmentByManageTokenHash(roster, issuedA.token)?.id, "eea_a");
assert.equal(findAppointmentByManageTokenHash(roster, issuedB.token)?.id, "eea_b");
assert.equal(findAppointmentByManageTokenHash(roster, issuedA.token)?.id, customerA.id);
assert.notEqual(
  findAppointmentByManageTokenHash(roster, issuedA.token)?.id,
  customerB.id,
);
assert.equal(findAppointmentByManageTokenHash(roster, "not-a-real-token-value-here"), null);
assert.equal(findAppointmentByManageTokenHash(roster, ""), null);
assert.equal(findAppointmentByManageTokenHash(roster, "short"), null);

const validAccess = evaluateManageAccess(customerA, new Date("2026-10-15T08:00:00.000Z"));
assert.equal(validAccess.ok, true);

const expiredAccess = evaluateManageAccess(
  customerA,
  new Date("2026-10-16T08:00:01.000Z"),
);
assert.equal(expiredAccess.ok, false);
if (!expiredAccess.ok) {
  assert.equal(expiredAccess.reason, "expired");
  assert.equal(manageAccessMessage(expiredAccess.reason), EXPIRED_MANAGE_LINK_MESSAGE);
}

const cancelled = {
  ...customerA,
  status: "cancelled" as const,
  manageTokenRevokedAt: "2026-10-15T07:00:00.000Z",
};
const revokedAccess = evaluateManageAccess(cancelled, new Date("2026-10-15T08:00:00.000Z"));
assert.equal(revokedAccess.ok, false);
if (!revokedAccess.ok) {
  assert.equal(revokedAccess.reason, "revoked");
  assert.equal(manageAccessMessage(revokedAccess.reason), EXPIRED_MANAGE_LINK_MESSAGE);
}
assert.equal(canCustomerMutateBooking(customerA), true);
assert.equal(canCustomerMutateBooking(cancelled), false);
assert.equal(
  canCustomerMutateBooking({ ...customerA, status: "completed" }),
  false,
);

const dstExpiry = computeManageTokenExpiresAt("2026-10-15", "10:30", 30);
assert.equal(dstExpiry, "2026-10-16T08:00:00.000Z");
const winterExpiry = computeManageTokenExpiresAt("2026-11-15", "10:30", 30);
assert.equal(winterExpiry, "2026-11-16T09:00:00.000Z");
const rescheduledExpiry = computeManageTokenExpiresAt("2026-10-20", "14:00", 30);
assert.equal(rescheduledExpiry, "2026-10-21T11:30:00.000Z");
assert.notEqual(dstExpiry, rescheduledExpiry);

const view = publicManageAppointmentView(customerA, "فحص نظر");
assert.equal(view.customerName, "محمد علي");
assert.equal(view.service, "فحص نظر");
assert.equal(view.appointmentDate, "2026-10-15");
assert.equal(view.appointmentTime, "10:30");
assert.equal(view.status, "confirmed");
assert.equal("id" in view, false);
assert.equal("email" in view, false);
assert.equal("phone" in view, false);
assert.equal("manageTokenHash" in view, false);

const stripped = omitManageTokenSecrets(customerA);
assert.equal("manageTokenHash" in stripped, false);
assert.equal(stripped.id, "eea_a");

const dateLabel = formatEyeExamDateDisplay("2026-10-15");
assert.equal(dateLabel, "15/10/26");
const variables = buildManageTemplateContentVariables({
  customerName: "محمد علي",
  serviceLabel: "فحص نظر",
  dateLabel,
  time: "10:30",
  token: issuedA.token,
});
assert.deepEqual(Object.keys(variables), ["1", "2", "3", "4", "5"]);
assert.equal(variables["1"], "محمد علي");
assert.equal(variables["2"], "فحص نظر");
assert.equal(variables["3"], "15/10/26");
assert.equal(variables["4"], "10:30");
assert.equal(variables["5"], bookingManageUrlParam(issuedA.token));
assert.equal(variables["5"], issuedA.token);
assert.equal(
  bookingManageUrl(issuedA.token),
  `https://oyonoptics.com/appointments/manage/${issuedA.token}`,
);
assert.equal(
  BOOKING_MANAGE_CTA_URL,
  "https://oyonoptics.com/appointments/manage/{{5}}",
);

const defaults = mergeBookingMessages(null);
assert.equal(defaults.customerConfirmation.manageTemplateEnabled, false);
assert.equal(
  defaults.customerConfirmation.manageTemplateName,
  "oyon_booking_manage_v2_ar",
);
assert.equal(defaults.ownerNotification.templateName, "");
assert.equal(defaults.appointmentReminder.enabled, false);

const defaultPlan = resolveCustomerConfirmationTemplate(defaults);
assert.equal(defaultPlan.useManageTemplate, false);
assert.equal(defaultPlan.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

const enabledNoSid = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    manageTemplateEnabled: true,
  },
});
const enabledNoSidPlan = resolveCustomerConfirmationTemplate(enabledNoSid);
assert.equal(enabledNoSidPlan.useManageTemplate, false);
assert.equal(enabledNoSidPlan.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_ar:${sampleHxSid()}`;
resetTwilioContentSidMapForTests();
const enabledWithSid = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    manageTemplateEnabled: true,
    manageTemplateContentSid: sampleHxSid(),
  },
});
const enabledPlan = resolveCustomerConfirmationTemplate(enabledWithSid);
assert.equal(enabledPlan.useManageTemplate, true);
assert.equal(enabledPlan.templateName, "oyon_booking_manage_v2_ar");
assert.equal(enabledPlan.contentSid, sampleHxSid());
const liveIfMissingToken = enabledPlan.useManageTemplate && Boolean(undefined);
assert.equal(liveIfMissingToken, false);

assert.equal(OWNER_NOTIFICATION_TEMPLATE, "owner_notification");
assert.equal(APPOINTMENT_REMINDER_TEMPLATE, "appointment_reminder");
assert.equal(
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
  "oyon_booking_confirmation_hx716fcfd9ac41ae0e332e569b9b4fbc39",
);

assert.equal(sanitizeTwilioContentSid(sampleHxSid()), sampleHxSid());
assert.equal(sanitizeTwilioContentSid("AC" + "0".repeat(32)), null);
assert.equal(sanitizeTwilioContentSid("not-a-sid"), null);

const manageClient = readFileSync(
  join(process.cwd(), "components/booking/ManageBookingClient.tsx"),
  "utf8",
);
const managePage = readFileSync(
  join(process.cwd(), "app/appointments/manage/page.tsx"),
  "utf8",
);
const manageApi = readFileSync(
  join(process.cwd(), "app/api/booking/manage/route.ts"),
  "utf8",
);
assert.doesNotMatch(manageClient, /\botp\b/i);
assert.doesNotMatch(managePage, /\botp\b/i);
assert.doesNotMatch(manageApi, /\botp\b/i);
assert.match(manageApi, /rateLimit/);
assert.match(manageApi, /x-booking-token/);
assert.doesNotMatch(manageApi, /searchParams\.get\("token"\)/);

const messaging = readFileSync(
  join(process.cwd(), "lib/booking-messaging.ts"),
  "utf8",
);
assert.match(messaging, /OWNER_NOTIFICATION_TEMPLATE = "owner_notification"/);
assert.match(messaging, /APPOINTMENT_REMINDER_TEMPLATE = "appointment_reminder"/);
assert.match(messaging, /manageTemplateEnabled === true/);
assert.match(messaging, /shouldSkipBookingWhatsApp/);

assert.equal(isBookingManagePreviewTestAllowed("production", "production"), false);
assert.equal(isBookingManagePreviewTestAllowed("preview", "production"), true);
assert.equal(isBookingManagePreviewTestAllowed("development", "production"), true);
assert.equal(isBookingManagePreviewTestAllowed(undefined, "development"), true);
assert.equal(isBookingManagePreviewTestAllowed(undefined, "production"), false);

assert.equal(shouldSkipBookingWhatsApp("production", "production"), false);
assert.equal(shouldSkipBookingWhatsApp("preview", "production"), true);
assert.equal(shouldSkipBookingWhatsApp("development", "production"), true);

const previewOrigin = bookingManageOriginFromRequest(
  new Request("https://example.vercel.app/api/internal/booking-manage-test", {
    headers: {
      host: "premiumopticalstore-git-preview.vercel.app",
      "x-forwarded-proto": "https",
    },
  }),
);
assert.equal(previewOrigin, "https://premiumopticalstore-git-preview.vercel.app");
assert.equal(
  bookingManageUrlForOrigin(previewOrigin, issuedA.token),
  `https://premiumopticalstore-git-preview.vercel.app/appointments/manage/${issuedA.token}`,
);
assert.notEqual(previewOrigin, "https://oyonoptics.com");

const testApi = readFileSync(
  join(process.cwd(), "app/api/internal/booking-manage-test/route.ts"),
  "utf8",
);
assert.doesNotMatch(testApi, /dispatchBookingMessages/);
assert.doesNotMatch(testApi, /eyeExamAppointments\.unshift/);
assert.match(testApi, /previewManageTestAppointments/);
assert.match(testApi, /isBookingManagePreviewTestAllowed/);

assert.equal(
  defaults.customerConfirmation.manageTemplateEnabled,
  false,
);

console.log("booking-manage tests passed");
