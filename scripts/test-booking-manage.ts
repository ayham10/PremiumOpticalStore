import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOOKING_MANAGE_CTA_URL,
  EXPIRED_MANAGE_LINK_MESSAGE,
} from "../lib/booking-manage-constants";
import {
  bookingManageOriginFromRequest,
  bookingManageTestMode,
  isBookingManageAdminTestAllowed,
  isBookingManagePreviewTestAllowed,
  pickPreviewTestSlot,
  shouldSkipBookingWhatsApp,
} from "../lib/booking-manage-test";
import {
  assertCustomerAppointmentsPreserved,
  customerFacingAppointments,
  isSilentManageTestAppointment,
  removeSilentManageTestAppointment,
  SILENT_MANAGE_TEST_ID_PREFIX,
} from "../lib/booking-silent-test";
import {
  parseStoreVersion,
  supabaseConditionalPatchPath,
} from "../lib/db/store";
import {
  DEFAULT_BOOKING_MANAGE_TEST_STORE_ID,
  parsePreviewTestPayload,
  resolvePreviewTestStoreConfig,
} from "../lib/booking-manage-test-store";
import {
  bookingManageUrl,
  bookingManageUrlForOrigin,
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
  manageTemplateNameForLanguage,
  omitManageTokenSecrets,
  publicManageAppointmentView,
} from "../lib/booking-manage-token";
import { mergeBookingMessages } from "../lib/booking-messages";
import {
  APPOINTMENT_REMINDER_TEMPLATE,
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
  OWNER_NOTIFICATION_TEMPLATE,
  resolveCustomerConfirmationTemplate,
  shouldDispatchBookingMessages,
} from "../lib/booking-messaging";
import { formatEyeExamDateDisplay, hasEyeExamSlotConflict } from "../lib/eye-exam";
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

assert.equal(manageTemplateNameForLanguage("he"), "oyon_booking_manage_v2_he");
assert.equal(manageTemplateNameForLanguage("ar"), "oyon_booking_manage_v2_ar");
assert.equal(
  resolveCustomerConfirmationTemplate(defaults, "he").useManageTemplate,
  false,
);
assert.equal(
  resolveCustomerConfirmationTemplate(defaults, "he").templateName,
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
);

const heSid = `HX${"c".repeat(32)}`;
process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_ar:${sampleHxSid()},oyon_booking_manage_v2_he:${heSid}`;
resetTwilioContentSidMapForTests();
const enabledLang = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    manageTemplateEnabled: true,
  },
});
const heEnabledPlan = resolveCustomerConfirmationTemplate(enabledLang, "he");
assert.equal(heEnabledPlan.useManageTemplate, true);
assert.equal(heEnabledPlan.templateName, "oyon_booking_manage_v2_he");
assert.equal(heEnabledPlan.contentSid, heSid);
assert.equal(
  resolveCustomerConfirmationTemplate(enabledLang, "ar").templateName,
  "oyon_booking_manage_v2_ar",
);

process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_ar:${sampleHxSid()}`;
resetTwilioContentSidMapForTests();
const heWithoutSid = resolveCustomerConfirmationTemplate(enabledWithSid, "he");
assert.equal(heWithoutSid.useManageTemplate, false);
assert.equal(heWithoutSid.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

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
assert.match(messaging, /isSilentManageTestAppointment/);
assert.match(messaging, /shouldDispatchBookingMessages/);
assert.match(messaging, /CUSTOMER_MANAGE_TEMPLATE_NAME_HE/);
assert.match(
  readFileSync(join(process.cwd(), "lib/booking-manage-constants.ts"), "utf8"),
  /oyon_booking_manage_v2_he/,
);

assert.equal(isBookingManagePreviewTestAllowed("production", "production"), false);
assert.equal(isBookingManagePreviewTestAllowed("preview", "production"), true);
assert.equal(isBookingManagePreviewTestAllowed("development", "production"), true);
assert.equal(isBookingManagePreviewTestAllowed(undefined, "development"), true);
assert.equal(isBookingManagePreviewTestAllowed(undefined, "production"), false);
assert.equal(bookingManageTestMode("production", "production"), "production-silent");
assert.equal(bookingManageTestMode("preview", "production"), "preview-isolated");
assert.equal(isBookingManageAdminTestAllowed("production", "production"), true);

assert.equal(shouldSkipBookingWhatsApp("production", "production"), false);
assert.equal(shouldSkipBookingWhatsApp("preview", "production"), true);
assert.equal(shouldSkipBookingWhatsApp("development", "production"), true);

const silentTest = appointment({
  id: `${SILENT_MANAGE_TEST_ID_PREFIX}abc`,
  firstName: "OYON",
  lastName: "TEST",
  silentTest: true,
  smsStatus: "simulated",
});
const liveCustomer = appointment({
  id: "eea_live",
  firstName: "Real",
  lastName: "Customer",
});
assert.equal(isSilentManageTestAppointment(silentTest), true);
assert.equal(isSilentManageTestAppointment(liveCustomer), false);
assert.deepEqual(customerFacingAppointments([silentTest, liveCustomer]).map((item) => item.id), [
  "eea_live",
]);
assert.equal(
  hasEyeExamSlotConflict([silentTest], "2026-10-15", "10:30"),
  false,
);
assert.equal(
  hasEyeExamSlotConflict([liveCustomer], "2026-10-15", "10:30"),
  true,
);
assert.equal(
  shouldDispatchBookingMessages(silentTest, "production", "production"),
  false,
);
assert.equal(
  shouldDispatchBookingMessages(liveCustomer, "production", "production"),
  true,
);
assert.equal(
  shouldDispatchBookingMessages(liveCustomer, "preview", "production"),
  false,
);

const afterSilentCreate = [silentTest, liveCustomer];
assertCustomerAppointmentsPreserved([liveCustomer], afterSilentCreate);
assert.throws(() =>
  assertCustomerAppointmentsPreserved(
    [liveCustomer],
    [{ ...liveCustomer, status: "cancelled" }],
  ),
);
const afterSilentDelete = removeSilentManageTestAppointment(
  afterSilentCreate,
  silentTest.id,
);
assert.deepEqual(
  afterSilentDelete.map((item) => item.id),
  ["eea_live"],
);
assert.throws(() =>
  removeSilentManageTestAppointment([liveCustomer], liveCustomer.id),
);
assert.equal(
  supabaseConditionalPatchPath("lumina_store", "default", 7),
  "lumina_store?id=eq.default&payload->>version=eq.7",
);
assert.equal(
  supabaseConditionalPatchPath("lumina_store", "default", null),
  "lumina_store?id=eq.default&payload->>version=is.null",
);
assert.equal(parseStoreVersion(4), 4);
assert.equal(parseStoreVersion("12"), 12);
assert.equal(parseStoreVersion(undefined), null);

const previewOrigin = bookingManageOriginFromRequest(
  new Request("https://example.vercel.app/api/internal/booking-manage-test", {
    headers: {
      host: "premiumopticalstore-git-preview.vercel.app",
      "x-forwarded-proto": "https",
    },
  }),
  "preview",
);
assert.equal(previewOrigin, "https://premiumopticalstore-git-preview.vercel.app");
assert.equal(
  bookingManageUrlForOrigin(previewOrigin, issuedA.token),
  `https://premiumopticalstore-git-preview.vercel.app/appointments/manage/${issuedA.token}`,
);
assert.notEqual(previewOrigin, "https://oyonoptics.com");
assert.equal(
  bookingManageOriginFromRequest(
    new Request("https://oyonoptics.com/api/internal/booking-manage-test", {
      headers: {
        host: "oyonoptics.com",
        "x-forwarded-proto": "https",
      },
    }),
    "production",
  ),
  "https://oyonoptics.com",
);

const testApi = readFileSync(
  join(process.cwd(), "app/api/internal/booking-manage-test/route.ts"),
  "utf8",
);
assert.doesNotMatch(testApi, /dispatchBookingMessages/);
assert.doesNotMatch(testApi, /sendSms/);
assert.match(testApi, /updateStore/);
assert.match(testApi, /silentTest: true/);
assert.match(testApi, /writePreviewTestAppointments/);
assert.match(testApi, /isBookingManagePreviewTestAllowed/);
assert.match(testApi, /role !== "admin"/);
assert.match(testApi, /isSilentManageTestAppointment/);
assert.match(testApi, /assertCustomerAppointmentsPreserved/);
assert.match(testApi, /removeSilentManageTestAppointment/);
assert.doesNotMatch(testApi, /writeFilesystem|\/var\/task\/data/);

const adminLayout = readFileSync(
  join(process.cwd(), "app/admin/dev/booking-manage/layout.tsx"),
  "utf8",
);
assert.match(adminLayout, /requireSession/);
assert.match(adminLayout, /role !== "admin"/);

const storeSrc = readFileSync(join(process.cwd(), "lib/db/store.ts"), "utf8");
assert.match(storeSrc, /StoreWriteConflictError/);
assert.match(storeSrc, /STORE_CONFLICT_RETRIES/);
assert.match(storeSrc, /ifVersion/);

const bookRoute = readFileSync(
  join(process.cwd(), "app/api/eye-exam/book/route.ts"),
  "utf8",
);
assert.match(bookRoute, /dispatchBookingMessages/);
assert.match(bookRoute, /sendSms/);

const adminTestPage = readFileSync(
  join(process.cwd(), "app/admin/dev/booking-manage/page.tsx"),
  "utf8",
);
assert.match(adminTestPage, /Create test appointment/);
assert.match(adminTestPage, /Delete/);
assert.doesNotMatch(adminTestPage, /bypass|skipNotifications|skip WhatsApp checkbox/i);

const smsProvider = readFileSync(join(process.cwd(), "lib/sms/provider.ts"), "utf8");
assert.match(smsProvider, /SILENT_MANAGE_TEST_ID_PREFIX/);

const dashboardApi = readFileSync(
  join(process.cwd(), "app/api/dashboard/route.ts"),
  "utf8",
);
assert.match(dashboardApi, /customerFacingAppointments/);

const managePatch = readFileSync(
  join(process.cwd(), "app/api/booking/manage/route.ts"),
  "utf8",
);
assert.doesNotMatch(managePatch, /dispatchBookingMessages/);
assert.doesNotMatch(managePatch, /sendSms/);

const missingSecret = resolvePreviewTestStoreConfig({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_STORE_ID: "default",
});
assert.equal(missingSecret.ok, false);
if (!missingSecret.ok) {
  assert.ok(
    missingSecret.missing.some((item) => item.includes("SUPABASE_SECRET_KEY")),
  );
}

const blockedDefaultId = resolvePreviewTestStoreConfig({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "secret",
  BOOKING_MANAGE_TEST_STORE_ID: "default",
});
assert.equal(blockedDefaultId.ok, false);

const isolated = resolvePreviewTestStoreConfig({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "secret",
  SUPABASE_STORE_ID: "default",
});
assert.equal(isolated.ok, true);
if (isolated.ok) {
  assert.equal(isolated.config.storeId, DEFAULT_BOOKING_MANAGE_TEST_STORE_ID);
  assert.notEqual(isolated.config.storeId, "default");
}

assert.throws(() =>
  parsePreviewTestPayload({
    products: [],
    eyeExamAppointments: [{ id: "eea_live" }],
  }),
);

const parsed = parsePreviewTestPayload({
  kind: "oyon_booking_manage_preview_tests",
  appointments: [customerA],
});
assert.equal(parsed[0]?.id, "eea_a");

const slot = pickPreviewTestSlot();
assert.ok(slot);
assert.match(slot!.date, /^\d{4}-\d{2}-\d{2}$/);
assert.match(slot!.time, /^\d{2}:\d{2}$/);

assert.equal(
  defaults.customerConfirmation.manageTemplateEnabled,
  false,
);

console.log("booking-manage tests passed");
