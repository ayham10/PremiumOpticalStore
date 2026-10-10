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
import { mergeBookingMessages } from "../lib/booking-messages";
import {
  LIVE_CUSTOMER_CONFIRMATION_TEMPLATE,
  OWNER_CANCELLED_TEMPLATE,
  OWNER_RESCHEDULED_TEMPLATE,
  buildOwnerCancelContentVariables,
  buildOwnerRescheduleContentVariables,
  ownerCancelDedupNote,
  ownerLifecycleAlreadySent,
  ownerLifecycleSkipReason,
  ownerRescheduleDedupNote,
  resolveCustomerConfirmationTemplate,
} from "../lib/booking-messaging";
import { formatEyeExamDateDisplay } from "../lib/eye-exam";
import {
  approvedTwilioTemplatesPublicStatus,
  isApprovedTwilioTemplateConfigured,
  resetTwilioContentSidMapForTests,
  resolveDedicatedTwilioContentSid,
  resolveTwilioContentSid,
} from "../lib/twilio/content-sids";
import type { AppData, SmsLog } from "../lib/types";

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
const hePlan = resolveCustomerConfirmationTemplate(defaults, "he");
assert.equal(hePlan.useManageTemplate, true);
assert.equal(hePlan.templateName, "oyon_booking_manage_v2_he");
assert.equal(hePlan.contentSid, heSid);

const arPlan = resolveCustomerConfirmationTemplate(defaults, "ar");
assert.equal(arPlan.useManageTemplate, true);
assert.equal(arPlan.templateName, "oyon_booking_manage_v2_ar");
assert.equal(arPlan.contentSid, arSid);

const enPlan = resolveCustomerConfirmationTemplate(defaults, "en");
assert.equal(enPlan.useManageTemplate, false);
assert.equal(enPlan.templateName, LIVE_CUSTOMER_CONFIRMATION_TEMPLATE);

const enabledEnglish = mergeBookingMessages({
  customerConfirmation: {
    ...defaults.customerConfirmation,
    manageTemplateEnabled: true,
  },
});
assert.equal(
  resolveCustomerConfirmationTemplate(enabledEnglish, "en").useManageTemplate,
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
      manageTemplateEnabled: true,
    },
  }),
  "he",
);
assert.equal(mapHe.useManageTemplate, true);
assert.equal(mapHe.contentSid, mapOnlySid);

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
assert.match(messaging, /resolveDedicatedTwilioContentSid/);
assert.match(messaging, /OWNER_CANCELLED_TEMPLATE/);
assert.equal(messaging.includes("sendCustomerConfirmationViaTwilio(appointment"), true);
assert.equal(
  /dispatchOwnerCancelNotification[\s\S]*sendCustomerConfirmationViaTwilio/.test(
    messaging,
  ),
  false,
);

console.log("whatsapp-templates tests passed");
