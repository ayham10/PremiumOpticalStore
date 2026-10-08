process.env.BOOKING_E2E_ISOLATED = "1";
process.env.VERCEL_ENV = "e2e";
process.env.SMS_PROVIDER = "console";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;

async function main() {
const assert = (await import("node:assert/strict")).default;
const { readFileSync } = await import("node:fs");
const { join } = await import("node:path");

const { createSeedData } = await import("../lib/seed");
const { pickPreviewTestSlot } = await import("../lib/booking-manage-test");
const {
  beginIsolatedStore,
  endIsolatedStore,
  getE2EOutbounds,
  getIsolatedStore,
  setIsolatedStore,
  takeE2EManageToken,
} = await import("../lib/booking-e2e");
const {
  BOOKING_MANAGE_CTA_URL,
  EXPIRED_MANAGE_LINK_MESSAGE,
} = await import("../lib/booking-manage-constants");
const {
  bookingIdentitySnapshot,
  planAdminManageLinkGeneration,
} = await import("../lib/admin-manage-link");
const {
  buildManageTemplateContentVariables,
  bookingManageUrlParam,
  findAppointmentByManageTokenHash,
  hashBookingManageToken,
} = await import("../lib/booking-manage-token");
const { listBookableTimes } = await import("../lib/eye-exam");
const { POST: bookPost } = await import("../app/api/eye-exam/book/route");
const { GET: manageGet, PATCH: managePatch } = await import(
  "../app/api/booking/manage/route"
);
const { GET: availableTimesGet } = await import(
  "../app/api/eye-exam/available-times/route"
);

const seed = createSeedData();
seed.eyeExamAppointments = [];
seed.smsLogs = [];
seed.activityLogs = [];
beginIsolatedStore(seed);

const slot = pickPreviewTestSlot(seed);
assert.ok(slot, "seed clinic schedule should expose a bookable slot");

function jsonRequest(
  url: string,
  init: RequestInit = {},
): Request {
  return new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...(init.headers || {}),
    },
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function bookCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: "ar" | "he";
  date: string;
  time: string;
  type: string;
}) {
  const response = await bookPost(
    jsonRequest("http://localhost/api/eye-exam/book", {
      method: "POST",
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        language: input.language,
        appointmentDate: input.date,
        appointmentTime: input.time,
        appointmentType: input.type,
      }),
    }),
  );
  const body = await readJson(response);
  assert.equal(response.status, 201, String(body.error || response.status));
  const appointment = body.appointment as {
    id: string;
    firstName: string;
    lastName: string;
    appointmentDate: string;
    appointmentTime: string;
  };
  const token = takeE2EManageToken(appointment.id);
  assert.ok(token, "book handler must issue a management token");
  return { appointment, token };
}

const first = await bookCustomer({
  firstName: "Amina",
  lastName: "Saleh",
  email: "amina-e2e@oyonoptics.invalid",
  phone: "+972501111111",
  language: "ar",
  date: slot!.date,
  time: slot!.time,
  type: slot!.appointmentType,
});

const isolatedAfterFirst = getIsolatedStore();
assert.ok(isolatedAfterFirst);
const day = isolatedAfterFirst!.eyeExamAvailability.find(
  (item) => item.date === slot!.date,
);
assert.ok(day);
const remaining = listBookableTimes(day!, isolatedAfterFirst!.eyeExamAppointments, {
  appointmentType: slot!.appointmentType,
});
const secondTime = remaining.find((time) => time !== slot!.time);
assert.ok(secondTime, "need a second open slot for a unique booking");

const second = await bookCustomer({
  firstName: "Dana",
  lastName: "Cohen",
  email: "dana-e2e@oyonoptics.invalid",
  phone: "+972502222222",
  language: "he",
  date: slot!.date,
  time: secondTime!,
  type: slot!.appointmentType,
});

assert.notEqual(first.token, second.token);
assert.notEqual(
  hashBookingManageToken(first.token),
  hashBookingManageToken(second.token),
);
assert.equal("manageToken" in first.appointment, false);
assert.equal("manageTokenHash" in first.appointment, false);

const firstGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": first.token },
  }),
);
const firstView = await readJson(firstGet);
assert.equal(firstGet.status, 200);
const firstAppt = firstView.appointment as {
  customerName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
};
assert.equal(firstAppt.customerName, "Amina Saleh");
assert.equal(firstAppt.appointmentDate, slot!.date);
assert.equal(firstAppt.appointmentTime, slot!.time);
assert.equal(firstAppt.status, "confirmed");
assert.equal("otp" in firstView, false);

const secondGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": second.token },
  }),
);
const secondView = await readJson(secondGet);
assert.equal(secondGet.status, 200);
assert.equal(
  (secondView.appointment as { customerName: string }).customerName,
  "Dana Cohen",
);

const storeBeforeRotate = getIsolatedStore();
assert.ok(storeBeforeRotate);
const secondRow = storeBeforeRotate!.eyeExamAppointments.find(
  (item) => item.id === second.appointment.id,
);
assert.ok(secondRow);
const identityBefore = bookingIdentitySnapshot(secondRow!);
const unconfirmed = planAdminManageLinkGeneration(secondRow!);
assert.equal(unconfirmed.ok, false);
if (!unconfirmed.ok) assert.equal(unconfirmed.error, "NEEDS_CONFIRM");

const adminLink = planAdminManageLinkGeneration(secondRow!, {
  confirmRotate: true,
});
assert.equal(adminLink.ok, true);
if (!adminLink.ok) throw new Error("expected admin rotate");
assert.notEqual(adminLink.token, second.token);
assert.deepEqual(bookingIdentitySnapshot(adminLink.next), identityBefore);
const rotatedStore = getIsolatedStore();
assert.ok(rotatedStore);
const rotateIndex = rotatedStore!.eyeExamAppointments.findIndex(
  (item) => item.id === second.appointment.id,
);
rotatedStore!.eyeExamAppointments[rotateIndex] = adminLink.next;
setIsolatedStore(rotatedStore!);
assert.equal(
  findAppointmentByManageTokenHash(
    getIsolatedStore()!.eyeExamAppointments,
    second.token,
  ),
  null,
);

const oldTokenGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": second.token },
  }),
);
assert.equal(oldTokenGet.status, 404);

const rotatedGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": adminLink.token },
  }),
);
const rotatedView = await readJson(rotatedGet);
assert.equal(rotatedGet.status, 200);
assert.equal("otp" in rotatedView, false);
assert.equal(
  (rotatedView.appointment as { customerName: string }).customerName,
  "Dana Cohen",
);

const cancelledBlock = planAdminManageLinkGeneration(
  { ...adminLink.next, status: "cancelled" },
  { confirmRotate: true },
);
assert.equal(cancelledBlock.ok, false);
if (!cancelledBlock.ok) assert.equal(cancelledBlock.error, "CANCELLED");

const expiredBlock = planAdminManageLinkGeneration(
  {
    ...adminLink.next,
    appointmentDate: "2000-01-02",
    appointmentTime: "09:00",
  },
  { confirmRotate: true },
);
assert.equal(expiredBlock.ok, false);
if (!expiredBlock.ok) assert.equal(expiredBlock.error, "EXPIRED");

const timesRes = await availableTimesGet(
  jsonRequest(
    `http://localhost/api/eye-exam/available-times?date=${slot!.date}&type=${slot!.appointmentType}`,
  ),
);
const timesBody = await readJson(timesRes);
assert.equal(timesRes.status, 200);
const openTimes = timesBody.times as string[];
const rescheduleTime =
  openTimes.find((time) => time !== firstAppt.appointmentTime) || secondTime!;

const reschedule = await managePatch(
  jsonRequest("http://localhost/api/booking/manage", {
    method: "PATCH",
    headers: { "x-booking-token": first.token },
    body: JSON.stringify({
      action: "reschedule",
      appointmentDate: slot!.date,
      appointmentTime: rescheduleTime,
    }),
  }),
);
const rescheduleBody = await readJson(reschedule);
assert.equal(reschedule.status, 200, String(rescheduleBody.error || ""));
assert.equal(
  (rescheduleBody.appointment as { appointmentTime: string }).appointmentTime,
  rescheduleTime,
);

const refresh = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": first.token },
  }),
);
const refreshBody = await readJson(refresh);
assert.equal(refresh.status, 200);
assert.equal(
  (refreshBody.appointment as { appointmentTime: string }).appointmentTime,
  rescheduleTime,
);

const cancel = await managePatch(
  jsonRequest("http://localhost/api/booking/manage", {
    method: "PATCH",
    headers: { "x-booking-token": first.token },
    body: JSON.stringify({ action: "cancel" }),
  }),
);
const cancelBody = await readJson(cancel);
assert.equal(cancel.status, 200);
assert.equal((cancelBody.appointment as { status: string }).status, "cancelled");

const cancelledGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": first.token },
  }),
);
const cancelledBody = await readJson(cancelledGet);
assert.equal(cancelledGet.status, 410);
assert.equal(cancelledBody.error, EXPIRED_MANAGE_LINK_MESSAGE);
assert.equal(cancelledBody.reason, "revoked");

const mutateCancelled = await managePatch(
  jsonRequest("http://localhost/api/booking/manage", {
    method: "PATCH",
    headers: { "x-booking-token": first.token },
    body: JSON.stringify({
      action: "reschedule",
      appointmentDate: slot!.date,
      appointmentTime: rescheduleTime,
    }),
  }),
);
assert.ok(mutateCancelled.status === 410 || mutateCancelled.status === 409);

const invalidGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": "not-a-real-token-value-here-12345" },
  }),
);
assert.equal(invalidGet.status, 404);

const live = getIsolatedStore();
assert.ok(live);
const rotatedRow = live!.eyeExamAppointments.find(
  (item) => item.id === second.appointment.id,
);
assert.ok(rotatedRow);
rotatedRow!.manageTokenExpiresAt = "2000-01-01T00:00:00.000Z";
setIsolatedStore(live!);
const expiredGet = await manageGet(
  jsonRequest("http://localhost/api/booking/manage", {
    headers: { "x-booking-token": adminLink.token },
  }),
);
const expiredBody = await readJson(expiredGet);
assert.equal(expiredGet.status, 410);
assert.equal(expiredBody.reason, "expired");
assert.equal(expiredBody.error, EXPIRED_MANAGE_LINK_MESSAGE);

const variables = buildManageTemplateContentVariables({
  customerName: "Amina Saleh",
  serviceLabel: "فحص نظر",
  dateLabel: "15/10/26",
  time: "10:30",
  token: first.token,
});
assert.equal(variables["5"], bookingManageUrlParam(first.token));
assert.equal(variables["5"], first.token);
assert.equal(
  BOOKING_MANAGE_CTA_URL,
  "https://oyonoptics.com/appointments/manage/{{5}}",
);

const outbounds = getE2EOutbounds();
assert.equal(outbounds.length, 0, JSON.stringify(outbounds));
assert.equal(
  getIsolatedStore()?.smsLogs.length,
  0,
);

const bookSource = readFileSync(
  join(process.cwd(), "app/api/eye-exam/book/route.ts"),
  "utf8",
);
assert.match(bookSource, /recordE2EManageToken/);
assert.match(bookSource, /isBookingE2EIsolated/);
const appointmentsSource = readFileSync(
  join(process.cwd(), "app/api/appointments/route.ts"),
  "utf8",
);
assert.match(appointmentsSource, /deliverAppointmentSms/);
assert.doesNotMatch(
  appointmentsSource.replace(/async function deliverAppointmentSms[\s\S]*?\n\}/, ""),
  /await sendSms/,
);
const storeSource = readFileSync(join(process.cwd(), "lib/db/store.ts"), "utf8");
assert.match(storeSource, /payload->>version=is\.null/);
const manageLinkSource = readFileSync(
  join(process.cwd(), "app/api/admin/eye-exam/appointments/manage-link/route.ts"),
  "utf8",
);
assert.match(manageLinkSource, /role !== "admin"/);
assert.doesNotMatch(manageLinkSource, /dispatchBookingMessages/);
assert.doesNotMatch(manageLinkSource, /sendSms/);
const patchAppointmentsSource = readFileSync(
  join(process.cwd(), "app/api/admin/eye-exam/appointments/route.ts"),
  "utf8",
);
assert.doesNotMatch(patchAppointmentsSource, /issueBookingManageToken/);
const editModalSource = readFileSync(
  join(process.cwd(), "app/admin/eye-exam/page.tsx"),
  "utf8",
);
assert.match(editModalSource, /admin-edit-booking-manage/);
assert.match(editModalSource, /admin\.bookings\.manageLinkGenerate/);

endIsolatedStore();
console.log("booking-manage isolated handler e2e passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
