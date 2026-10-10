import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TWILIO_APPROVED_MANAGE_CTA_URL,
  TWILIO_APPROVED_MANAGE_PATH,
  isCustomerManagePath,
} from "../lib/booking-manage-constants";
import {
  bookingManageUrlParam,
  buildManageTemplateContentVariables,
} from "../lib/booking-manage-token";
import {
  customerConfirmationMode,
  maskWhatsAppDestination,
  mergeBookingMessages,
  mergeOwnerNotification,
  resolveOwnerNotificationDestination,
} from "../lib/booking-messages";
import {
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
  OWNER_CANCELLED_TEMPLATE,
  OWNER_RESCHEDULED_TEMPLATE,
  buildOwnerCancelContentVariables,
  buildOwnerRescheduleContentVariables,
  customerConfirmationAlreadySent,
  ownerCancelDedupNote,
  ownerLifecycleAlreadySent,
  ownerLifecycleSkipReason,
  ownerRescheduleDedupNote,
  planCustomerConfirmationSend,
  resolveCustomerConfirmationTemplate,
} from "../lib/booking-messaging";
import { formatEyeExamDateDisplay } from "../lib/eye-exam";
import { mapTwilioAcceptStatus } from "../lib/twilio/whatsapp";
import {
  approvedTwilioTemplatesPublicStatus,
  isApprovedTwilioTemplateConfigured,
  resetTwilioContentSidMapForTests,
  resolveDedicatedTwilioContentSid,
  resolveTwilioContentSid,
} from "../lib/twilio/content-sids";
import type { AppData } from "../lib/types";

function sampleHx(char: string): string {
  return `HX${char.repeat(32)}`;
}

function clearTemplateEnv() {
  delete process.env.TWILIO_WHATSAPP_CONTENT_SIDS;
  delete process.env.TWILIO_TEMPLATE_BOOKING_HE;
  delete process.env.TWILIO_TEMPLATE_BOOKING_AR;
  delete process.env.TWILIO_TEMPLATE_OWNER_RESCHEDULED;
  delete process.env.TWILIO_TEMPLATE_OWNER_CANCELLED;
  resetTwilioContentSidMapForTests();
}

clearTemplateEnv();

const heSid = sampleHx("1");
const arSid = sampleHx("2");
const rescheduleSid = sampleHx("3");
const cancelSid = sampleHx("4");
const mapOnlySid = sampleHx("5");

process.env.TWILIO_TEMPLATE_BOOKING_HE = heSid;
process.env.TWILIO_TEMPLATE_BOOKING_AR = arSid;
process.env.TWILIO_TEMPLATE_OWNER_RESCHEDULED = rescheduleSid;
process.env.TWILIO_TEMPLATE_OWNER_CANCELLED = cancelSid;

assert.equal(
  resolveDedicatedTwilioContentSid("oyon_booking_manage_v2_he"),
  heSid,
);
assert.equal(
  resolveDedicatedTwilioContentSid("oyon_booking_manage_v2_ar"),
  arSid,
);
assert.equal(resolveTwilioContentSid(OWNER_RESCHEDULED_TEMPLATE), rescheduleSid);
assert.equal(resolveTwilioContentSid(OWNER_CANCELLED_TEMPLATE), cancelSid);
assert.equal(resolveTwilioContentSid("owner_notification"), null);

const defaults = mergeBookingMessages(null);
assert.equal(customerConfirmationMode(defaults), "original");
assert.equal(defaults.customerConfirmation.confirmationMode, "original");
const originalHe = resolveCustomerConfirmationTemplate(defaults, "he", "token");
assert.equal(originalHe.useManageTemplate, false);
assert.equal(originalHe.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);
assert.equal(originalHe.skipReason, null);
const originalPlans = planCustomerConfirmationSend(defaults, "he", "token");
assert.equal(originalPlans.length, 1);
assert.equal(originalPlans[0]?.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);
assert.equal(originalPlans[0]?.useManageTemplate, false);

const newSettings = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    confirmationMode: "new",
    manageTemplateEnabled: false,
  },
});
assert.equal(customerConfirmationMode(newSettings), "new");
const hePlan = resolveCustomerConfirmationTemplate(newSettings, "he", "token");
assert.equal(hePlan.useManageTemplate, true);
assert.equal(hePlan.templateName, "oyon_booking_manage_v2_he");
assert.equal(hePlan.contentSid, heSid);
assert.equal(hePlan.skipReason, null);
const newPlans = planCustomerConfirmationSend(newSettings, "he", "token");
assert.equal(newPlans.length, 1);
assert.equal(newPlans[0]?.templateName, "oyon_booking_manage_v2_he");
assert.notEqual(originalPlans[0]?.templateName, newPlans[0]?.templateName);
assert.equal(
  planCustomerConfirmationSend(defaults, "he", "token").length +
    planCustomerConfirmationSend(newSettings, "he", "token").length,
  2,
);

const arPlan = resolveCustomerConfirmationTemplate(newSettings, "ar", "token");
assert.equal(arPlan.useManageTemplate, true);
assert.equal(arPlan.templateName, "oyon_booking_manage_v2_ar");
assert.equal(arPlan.contentSid, arSid);

const enPlan = resolveCustomerConfirmationTemplate(newSettings, "en", "token");
assert.equal(enPlan.useManageTemplate, false);
assert.equal(enPlan.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

const legacyToggleOriginal = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    confirmationMode: "original",
    manageTemplateEnabled: true,
  },
});
assert.equal(
  resolveCustomerConfirmationTemplate(legacyToggleOriginal, "he", "token")
    .useManageTemplate,
  false,
);

const missingToken = resolveCustomerConfirmationTemplate(newSettings, "he");
assert.equal(missingToken.skipReason, "missing-token");
assert.equal(missingToken.useManageTemplate, false);

const enabledEnglish = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    confirmationMode: "new",
    manageTemplateEnabled: true,
  },
});
assert.equal(
  resolveCustomerConfirmationTemplate(enabledEnglish, "en", "token").useManageTemplate,
  false,
);

clearTemplateEnv();
process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_he:${mapOnlySid}`;
resetTwilioContentSidMapForTests();
assert.equal(resolveDedicatedTwilioContentSid("oyon_booking_manage_v2_he"), null);
assert.equal(resolveTwilioContentSid("oyon_booking_manage_v2_he"), mapOnlySid);
const mapHe = resolveCustomerConfirmationTemplate(
  mergeBookingMessages({
    customerConfirmation: {
      ...defaults.customerConfirmation,
      confirmationMode: "new",
    },
  }),
  "he",
  "token",
);
assert.equal(mapHe.useManageTemplate, true);
assert.equal(mapHe.contentSid, mapOnlySid);
const originalIgnoresMap = resolveCustomerConfirmationTemplate(
  mergeBookingMessages({
    customerConfirmation: {
      ...defaults.customerConfirmation,
      confirmationMode: "original",
    },
  }),
  "he",
  "token",
);
assert.equal(originalIgnoresMap.useManageTemplate, false);
assert.equal(originalIgnoresMap.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

clearTemplateEnv();
process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_he:${mapOnlySid}`;
process.env.TWILIO_TEMPLATE_BOOKING_HE = heSid;
resetTwilioContentSidMapForTests();
assert.equal(resolveTwilioContentSid("oyon_booking_manage_v2_he"), heSid);

const token = "manage-token-value-not-a-url";
const dateLabel = formatEyeExamDateDisplay("2026-10-15");
const customerVars = buildManageTemplateContentVariables({
  customerName: "דנה כהן",
  serviceLabel: "בדיקת ראיה",
  dateLabel,
  time: "18:30",
  token,
});
assert.deepEqual(Object.keys(customerVars), ["1", "2", "3", "4", "5"]);
assert.equal(customerVars["1"], "דנה כהן");
assert.equal(customerVars["2"], "בדיקת ראיה");
assert.equal(customerVars["3"], dateLabel);
assert.equal(customerVars["4"], "18:30");
assert.equal(customerVars["5"], bookingManageUrlParam(token));
assert.equal(customerVars["5"], token);
assert.doesNotMatch(customerVars["5"], /^https?:\/\//);

const rescheduleVars = buildOwnerRescheduleContentVariables({
  customerName: "محمد علي",
  customerPhone: "+972501234567",
  serviceLabel: "فحص نظر",
  originalDateLabel: formatEyeExamDateDisplay("2026-10-15"),
  originalTime: "10:30",
  newDateLabel: formatEyeExamDateDisplay("2026-10-16"),
  newTime: "11:00",
});
assert.deepEqual(Object.keys(rescheduleVars), [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
]);
assert.equal(rescheduleVars["1"], "محمد علي");
assert.equal(rescheduleVars["2"], "+972501234567");
assert.equal(rescheduleVars["3"], "فحص نظر");
assert.equal(rescheduleVars["4"], "15/10/26");
assert.equal(rescheduleVars["5"], "10:30");
assert.equal(rescheduleVars["6"], "16/10/26");
assert.equal(rescheduleVars["7"], "11:00");

const cancelVars = buildOwnerCancelContentVariables({
  customerName: "محمد علي",
  dateLabel: formatEyeExamDateDisplay("2026-10-15"),
  time: "10:30",
  customerPhone: "+972501234567",
  serviceLabel: "فحص نظر",
});
assert.deepEqual(Object.keys(cancelVars), ["1", "2", "3", "4", "5"]);
assert.equal(cancelVars["1"], "محمد علي");
assert.equal(cancelVars["2"], "15/10/26");
assert.equal(cancelVars["3"], "10:30");
assert.equal(cancelVars["4"], "+972501234567");
assert.equal(cancelVars["5"], "فحص نظر");

assert.equal(
  TWILIO_APPROVED_MANAGE_CTA_URL,
  "https://oyonoptics.com/booking/manage/{{5}}",
);
assert.equal(TWILIO_APPROVED_MANAGE_PATH, "/booking/manage");
assert.equal(isCustomerManagePath("/booking/manage/abc"), true);
assert.equal(isCustomerManagePath("/appointments/manage/abc"), true);
assert.equal(isCustomerManagePath("/book"), false);

const note = ownerRescheduleDedupNote(
  "2026-10-15",
  "10:30",
  "2026-10-16",
  "11:00",
);
const cancelNote = ownerCancelDedupNote("2026-10-15", "10:30");
const logs: SmsLog[] = [
  {
    id: "sms_1",
    to: "+972521111111",
    body: `WhatsApp:${OWNER_RESCHEDULED_TEMPLATE} (${note})`,
    type: "appointment_rescheduled",
    status: "queued",
    provider: "twilio",
    appointmentId: "eea_1",
    createdAt: "2026-10-10T00:00:00.000Z",
  },
];
const store = { smsLogs: logs } as AppData;
assert.equal(
  ownerLifecycleAlreadySent(store, "eea_1", "appointment_rescheduled", note),
  true,
);
assert.equal(
  ownerLifecycleAlreadySent(
    store,
    "eea_1",
    "appointment_rescheduled",
    ownerRescheduleDedupNote("2026-10-15", "10:30", "2026-10-20", "09:00"),
  ),
  false,
);
assert.equal(
  ownerLifecycleAlreadySent(store, "eea_1", "appointment_cancellation", cancelNote),
  false,
);

clearTemplateEnv();
const skipDisabled = ownerLifecycleSkipReason(defaults, OWNER_RESCHEDULED_TEMPLATE);
assert.equal(skipDisabled, "disabled");

const ownerOn = mergeBookingMessages({
  ownerNotification: {
    ...defaults.ownerNotification,
    enabled: true,
    ownerWhatsApp: "972521234567",
  },
});
assert.equal(
  ownerLifecycleSkipReason(ownerOn, OWNER_RESCHEDULED_TEMPLATE),
  "missing-template",
);
process.env.TWILIO_TEMPLATE_OWNER_RESCHEDULED = rescheduleSid;
assert.equal(ownerLifecycleSkipReason(ownerOn, OWNER_RESCHEDULED_TEMPLATE), null);

const ownerBusiness = mergeBookingMessages({
  ownerNotification: {
    ...defaults.ownerNotification,
    enabled: true,
    ownerWhatsApp: "0521234567",
    testWhatsApp: "0501234567",
    testDestinationEnabled: false,
  },
});
assert.deepEqual(resolveOwnerNotificationDestination(ownerBusiness), {
  to: "+972521234567",
  source: "business",
});
const ownerTest = mergeBookingMessages({
  ownerNotification: {
    ...ownerBusiness.ownerNotification,
    testDestinationEnabled: true,
  },
});
assert.equal(ownerTest.ownerNotification.ownerWhatsApp, "+972521234567");
assert.deepEqual(resolveOwnerNotificationDestination(ownerTest), {
  to: "+972501234567",
  source: "test",
});
const restored = mergeBookingMessages({
  ownerNotification: {
    ...ownerTest.ownerNotification,
    testDestinationEnabled: false,
  },
});
assert.deepEqual(resolveOwnerNotificationDestination(restored), {
  to: "+972521234567",
  source: "business",
});
assert.equal(restored.ownerNotification.testWhatsApp, "+972501234567");

const preserved = mergeOwnerNotification(
  {
    ...ownerBusiness.ownerNotification,
    ownerWhatsApp: "+972521234567",
  },
  {
    testDestinationEnabled: true,
    testWhatsApp: "0509998887",
    ownerWhatsApp: "",
  },
);
assert.equal(preserved.ownerWhatsApp, "+972521234567");
assert.deepEqual(resolveOwnerNotificationDestination(preserved), {
  to: "+972509998887",
  source: "test",
});

const invalidTest = mergeBookingMessages({
  ownerNotification: {
    ...ownerBusiness.ownerNotification,
    testDestinationEnabled: true,
    testWhatsApp: "not-a-phone",
  },
});
assert.equal(invalidTest.ownerNotification.ownerWhatsApp, "+972521234567");
assert.deepEqual(resolveOwnerNotificationDestination(invalidTest), {
  to: "",
  source: "missing",
});
assert.equal(maskWhatsAppDestination("+972521234567"), "+972••••4567");

const alreadySentStore = {
  smsLogs: [
    {
      id: "sms_wa",
      to: "+972501111111",
      body: `WhatsApp:${LIVE_CUSTOMER_CONFIRMATION_TEMPLATE}`,
      type: "appointment_confirmation",
      status: "queued",
      provider: "twilio",
      appointmentId: "eea_1",
      createdAt: "2026-10-10T00:00:00.000Z",
    },
  ],
} as AppData;
assert.equal(customerConfirmationAlreadySent(alreadySentStore, "eea_1"), true);
assert.equal(
  customerConfirmationAlreadySent(
    {
      smsLogs: [
        {
          id: "sms_sms",
          to: "+972501111111",
          body: "SMS confirmation",
          type: "appointment_confirmation",
          status: "sent",
          provider: "console",
          appointmentId: "eea_1",
          createdAt: "2026-10-10T00:00:00.000Z",
        },
      ],
    } as AppData,
    "eea_1",
  ),
  false,
);

assert.equal(mapTwilioAcceptStatus("queued"), "queued");
assert.equal(mapTwilioAcceptStatus("accepted"), "queued");
assert.equal(mapTwilioAcceptStatus("sent"), "sent");
assert.equal(mapTwilioAcceptStatus("delivered"), "sent");

const productionLike = mergeBookingMessages({
  customerConfirmation: {
    enabled: true,
    templateName: LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
    body: defaults.customerConfirmation.body,
    manageTemplateEnabled: true,
  },
});
assert.equal(customerConfirmationMode(productionLike), "original");
assert.equal(
  planCustomerConfirmationSend(productionLike, "he", "token")[0]?.templateName,
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
);

clearTemplateEnv();
process.env.TWILIO_TEMPLATE_BOOKING_HE = "not-a-sid";
assert.equal(isApprovedTwilioTemplateConfigured("oyon_booking_manage_v2_he"), false);
process.env.TWILIO_TEMPLATE_BOOKING_HE = heSid;
assert.equal(isApprovedTwilioTemplateConfigured("oyon_booking_manage_v2_he"), true);
const publicStatus = approvedTwilioTemplatesPublicStatus();
assert.equal(publicStatus.oyon_booking_manage_v2_he.configured, true);
assert.equal(publicStatus.oyon_booking_manage_v2_ar.configured, false);
assert.equal(
  JSON.stringify(publicStatus).includes("HX"),
  false,
);

const settingsUi = readFileSync(
  join(process.cwd(), "components/admin/BookingMessagesSettingsSection.tsx"),
  "utf8",
);
assert.match(settingsUi, /AccordionCard/);
assert.match(settingsUi, /aria-expanded/);
assert.match(settingsUi, /useState<AccordionId \| null>\(null\)/);
assert.match(settingsUi, /\{open \? \(/);
assert.match(settingsUi, /bmModeOriginal/);
assert.match(settingsUi, /bmModeNew/);
assert.match(settingsUi, /bmModeSaveHint/);
assert.match(settingsUi, /bmOwnerTestEnable/);
assert.match(settingsUi, /bmOwnerTestRestore/);
assert.match(settingsUi, /bmOwnerDestinationTest/);
assert.match(settingsUi, /confirmationMode: "original"/);
assert.match(settingsUi, /confirmationMode: "new"/);
assert.match(settingsUi, /bmBookingHe/);
assert.match(settingsUi, /bmBookingAr/);
assert.match(settingsUi, /bmOwnerRescheduled/);
assert.match(settingsUi, /bmOwnerCancelled/);
assert.match(settingsUi, /oyon_booking_manage_v2_he/);
assert.match(settingsUi, /oyon_booking_manage_v2_ar/);
assert.match(settingsUi, /oyon_booking_rescheduled_owner/);
assert.match(settingsUi, /oyon_booking_cancelled_owner/);
assert.doesNotMatch(settingsUi, /id="manage"/);
assert.doesNotMatch(
  settingsUi,
  /oyon_booking_manage_v2_ar \/ oyon_booking_manage_v2_he/,
);
assert.match(settingsUi, /https:\/\/oyonoptics\.com\/booking\/manage\/\{\{5\}\}/);
assert.doesNotMatch(settingsUi, /dispatchBookingMessages/);

const bookingMessagesSrc = readFileSync(
  join(process.cwd(), "lib/booking-messages.ts"),
  "utf8",
);
assert.match(bookingMessagesSrc, /from "\.\.\/lib\/israeli-phone"|from "@\/lib\/israeli-phone"/);
assert.doesNotMatch(bookingMessagesSrc, /from "@\/lib\/eye-exam"/);

const settingsRoute = readFileSync(
  join(process.cwd(), "app/api/settings/route.ts"),
  "utf8",
);
assert.match(settingsRoute, /toPublicSettings[\s\S]*ownerWhatsApp/);
assert.doesNotMatch(settingsRoute, /toPublicSettings[\s\S]*testWhatsApp/);
assert.match(settingsRoute, /mergeOwnerNotification/);

const templateStatusRoute = readFileSync(
  join(process.cwd(), "app/api/settings/twilio/templates/route.ts"),
  "utf8",
);
assert.match(templateStatusRoute, /requireSession\("settings"\)/);
assert.match(templateStatusRoute, /approvedTwilioTemplatesPublicStatus/);
assert.doesNotMatch(templateStatusRoute, /resolveTwilioContentSid\(/);
assert.doesNotMatch(templateStatusRoute, /process\.env/);

const accordionCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
assert.match(accordionCss, /\.admin-bm-acc-card:not\(\.is-open\)/);
assert.match(accordionCss, /max-height:\s*60px/);

const manageRoute = readFileSync(
  join(process.cwd(), "app/api/booking/manage/route.ts"),
  "utf8",
);
assert.doesNotMatch(manageRoute, /dispatchBookingMessages/);
assert.match(manageRoute, /dispatchOwnerCancelNotification/);
assert.match(manageRoute, /dispatchOwnerRescheduleNotification/);

const bookingPage = readFileSync(
  join(process.cwd(), "app/booking/manage/[token]/page.tsx"),
  "utf8",
);
assert.match(bookingPage, /ManageBookingClient/);

const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
assert.match(nextConfig, /\/booking\/manage\/:path\*/);

const messaging = readFileSync(
  join(process.cwd(), "lib/booking-messaging.ts"),
  "utf8",
);
assert.match(messaging, /Never sends a customer message/);
assert.match(messaging, /OWNER_CANCELLED_TEMPLATE/);
assert.match(messaging, /planCustomerConfirmationSend/);
assert.match(messaging, /customerConfirmationAlreadySent/);
const customerSendFn = messaging.slice(
  messaging.indexOf("async function sendCustomerConfirmationViaTwilio"),
  messaging.indexOf("async function sendConfiguredTemplate"),
);
assert.match(customerSendFn, /to: appointment\.phone/);
assert.doesNotMatch(customerSendFn, /ownerDestination/);
assert.equal(messaging.includes("sendCustomerConfirmationViaTwilio(appointment"), true);
assert.equal(
  /dispatchOwnerCancelNotification[\s\S]*sendCustomerConfirmationViaTwilio/.test(
    messaging,
  ),
  false,
);

console.log("whatsapp-templates tests passed");
