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
const {
  hasEyeExamSlotConflict,
  isScheduledClinicBooking,
  listBookableTimes,
} = await import("../lib/eye-exam");
const { POST: bookPost } = await import("../app/api/eye-exam/book/route");
const { GET: manageGet, PATCH: managePatch } = await import(
  "../app/api/booking/manage/route"
);
const { GET: availableTimesGet } = await import(
  "../app/api/eye-exam/available-times/route"
);
const { GET: availableDatesGet } = await import(
  "../app/api/eye-exam/available-dates/route"
);
const { GET: nextAvailableGet } = await import(
  "../app/api/eye-exam/next-available/route"
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

async function publicTimes(date: string, type: string) {
  const response = await availableTimesGet(
    jsonRequest(
      `http://localhost/api/eye-exam/available-times?date=${date}&type=${type}`,
    ),
  );
  const body = await readJson(response);
  assert.equal(response.status, 200, String(body.error || response.status));
  return (body.times as string[]) || [];
}

function scheduledRows() {
  return (getIsolatedStore()?.eyeExamAppointments || []).filter((item) =>
    isScheduledClinicBooking(item.status),
  );
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

async function bookAttempt(input: {
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
  return { status: response.status, body };
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

const occupiedAfterTwo = await publicTimes(slot!.date, slot!.appointmentType);
assert.equal(occupiedAfterTwo.includes(slot!.time), false);
assert.equal(occupiedAfterTwo.includes(secondTime!), false);
assert.equal(scheduledRows().length, 2);
assert.equal(
  hasEyeExamSlotConflict(
    getIsolatedStore()!.eyeExamAppointments,
    slot!.date,
    slot!.time,
  ),
  true,
);
const datesAfterTwo = await availableDatesGet(
  jsonRequest(
    `http://localhost/api/eye-exam/available-dates?type=${slot!.appointmentType}`,
  ),
);
const datesAfterTwoBody = await readJson(datesAfterTwo);
assert.equal(datesAfterTwo.status, 200);
assert.ok(
  ((datesAfterTwoBody.dates as Array<{ date: string }>) || []).some(
    (item) => item.date === slot!.date,
  ),
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

const openTimes = await publicTimes(slot!.date, slot!.appointmentType);
const rescheduleTime = openTimes.find(
  (time) => time !== firstAppt.appointmentTime && time !== secondTime,
);
assert.ok(rescheduleTime, "need a free slot to reschedule without overlapping");

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

const afterReschedule = getIsolatedStore()!;
assert.equal(
  afterReschedule.eyeExamAppointments.filter(
    (item) => item.id === first.appointment.id,
  ).length,
  1,
);
assert.equal(scheduledRows().length, 2);
const timesAfterReschedule = await publicTimes(slot!.date, slot!.appointmentType);
assert.equal(timesAfterReschedule.includes(slot!.time), true);
assert.equal(timesAfterReschedule.includes(rescheduleTime!), false);
assert.equal(
  hasEyeExamSlotConflict(
    afterReschedule.eyeExamAppointments,
    slot!.date,
    slot!.time,
  ),
  false,
);
assert.equal(
  hasEyeExamSlotConflict(
    afterReschedule.eyeExamAppointments,
    slot!.date,
    rescheduleTime!,
  ),
  true,
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

const afterCancel = getIsolatedStore()!;
const cancelledRow = afterCancel.eyeExamAppointments.find(
  (item) => item.id === first.appointment.id,
);
assert.ok(cancelledRow, "canceled bookings must remain in history");
assert.equal(cancelledRow!.status, "cancelled");
assert.equal(scheduledRows().length, 1);
assert.equal(
  scheduledRows().some((item) => item.id === first.appointment.id),
  false,
);
const timesAfterCancel = await publicTimes(slot!.date, slot!.appointmentType);
assert.equal(timesAfterCancel.includes(rescheduleTime!), true);
assert.equal(
  hasEyeExamSlotConflict(
    afterCancel.eyeExamAppointments,
    slot!.date,
    rescheduleTime!,
  ),
  false,
);

const rebooked = await bookCustomer({
  firstName: "Rami",
  lastName: "Nassar",
  email: "rami-e2e@oyonoptics.invalid",
  phone: "+972503333333",
  language: "ar",
  date: slot!.date,
  time: rescheduleTime!,
  type: slot!.appointmentType,
});
assert.equal(rebooked.appointment.appointmentTime, rescheduleTime);
assert.notEqual(rebooked.appointment.id, first.appointment.id);
assert.equal(scheduledRows().length, 2);
assert.equal(
  getIsolatedStore()!.eyeExamAppointments.filter(
    (item) => item.id === first.appointment.id && item.status === "cancelled",
  ).length,
  1,
);
const timesAfterRebook = await publicTimes(slot!.date, slot!.appointmentType);
assert.equal(timesAfterRebook.includes(rescheduleTime!), false);

const raceTime = timesAfterRebook.find((time) => time !== secondTime);
assert.ok(raceTime, "need a remaining free slot for a double-book race");
const [raceA, raceB] = await Promise.all([
  bookAttempt({
    firstName: "Lina",
    lastName: "Haddad",
    email: "lina-e2e@oyonoptics.invalid",
    phone: "+972504444444",
    language: "ar",
    date: slot!.date,
    time: raceTime!,
    type: slot!.appointmentType,
  }),
  bookAttempt({
    firstName: "Omar",
    lastName: "Aziz",
    email: "omar-e2e@oyonoptics.invalid",
    phone: "+972505555555",
    language: "he",
    date: slot!.date,
    time: raceTime!,
    type: slot!.appointmentType,
  }),
]);
const raceStatuses = [raceA.status, raceB.status].sort();
assert.deepEqual(raceStatuses, [201, 409]);
assert.equal(
  scheduledRows().filter(
    (item) =>
      item.appointmentDate === slot!.date && item.appointmentTime === raceTime,
  ).length,
  1,
);

const nextAvailable = await nextAvailableGet(
  jsonRequest(
    `http://localhost/api/eye-exam/next-available?type=${slot!.appointmentType}`,
  ),
);
const nextAvailableBody = await readJson(nextAvailable);
assert.equal(nextAvailable.status, 200);
assert.equal(nextAvailableBody.available, true);

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
