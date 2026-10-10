/**
 * Isolated booking-management security & reliability regressions.
 * Uses fixtures and the isolated E2E store. Never writes production data
 * or sends WhatsApp.
 */
process.env.BOOKING_E2E_ISOLATED = "1";
process.env.VERCEL_ENV = "e2e";
process.env.SMS_PROVIDER = "console";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_WHATSAPP_FROM;

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { createHash, randomBytes } = await import("node:crypto");

  const { createSeedData } = await import("../lib/seed");
  const { pickPreviewTestSlot } = await import("../lib/booking-manage-test");
  const {
    beginIsolatedStore,
    endIsolatedStore,
    getE2EOutbounds,
    getIsolatedStore,
    takeE2EManageToken,
  } = await import("../lib/booking-e2e");
  const {
    bookingIdentitySnapshot,
    planAdminManageLinkGeneration,
  } = await import("../lib/admin-manage-link");
  const {
    buildManageTemplateContentVariables,
    canCustomerMutateBooking,
    computeManageTokenExpiresAt,
    evaluateManageAccess,
    findAppointmentByManageTokenHash,
    generateBookingManageToken,
    hashBookingManageToken,
    issueBookingManageToken,
    omitManageTokenSecrets,
    publicManageAppointmentView,
  } = await import("../lib/booking-manage-token");
  const {
    customerConfirmationMode,
    mergeBookingMessages,
    mergeOwnerNotification,
    resolveOwnerNotificationDestination,
  } = await import("../lib/booking-messages");
  const {
    customerConfirmationAlreadySent,
    planCustomerConfirmationSend,
    resolveCustomerConfirmationTemplate,
    shouldDispatchBookingMessages,
  } = await import("../lib/booking-messaging");
  const { hasPermission, newId } = await import("../lib/auth");
  const {
    hasEyeExamSlotConflict,
    isScheduledClinicBooking,
    listBookableTimes,
    withEyeExamLock,
  } = await import("../lib/eye-exam");
  const { rateLimit } = await import("../lib/rate-limit");
  const {
    getTwilioConfig,
    getTwilioWhatsAppPublicStatus,
  } = await import("../lib/twilio/config");
  const {
    mapTwilioAcceptStatus,
    sendTwilioWhatsAppTemplate,
  } = await import("../lib/twilio/whatsapp");
  const { resetTwilioContentSidMapForTests } = await import(
    "../lib/twilio/content-sids"
  );
  const { POST: bookPost } = await import("../app/api/eye-exam/book/route");
  const { GET: manageGet, PATCH: managePatch } = await import(
    "../app/api/booking/manage/route"
  );

  const SAME_PHONE = "0501234567";
  const SAME_PHONE_E164 = "+972501234567";

  function appointment(
    overrides: Partial<import("../lib/types").EyeExamAppointment> &
      Pick<import("../lib/types").EyeExamAppointment, "id" | "firstName" | "lastName">,
  ): import("../lib/types").EyeExamAppointment {
    return {
      email: `${overrides.id}@example.com`,
      phone: SAME_PHONE_E164,
      appointmentDate: "2026-10-15",
      appointmentTime: "10:00",
      appointmentType: "eye_exam",
      status: "confirmed",
      language: "ar",
      smsStatus: "pending",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      ...overrides,
    };
  }

  function jsonRequest(url: string, init: RequestInit = {}) {
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

  function entropyBits(token: string) {
    const buf = Buffer.from(token, "base64url");
    return buf.length * 8;
  }

  // ---------------------------------------------------------------------------
  // Token generation, hashing, public view
  // ---------------------------------------------------------------------------
  const issuedA = issueBookingManageToken("2026-10-15", "10:00", 30);
  const issuedB = issueBookingManageToken("2026-10-20", "16:00", 30);
  assert.notEqual(issuedA.token, issuedB.token);
  assert.notEqual(issuedA.manageTokenHash, issuedB.manageTokenHash);
  assert.ok(entropyBits(issuedA.token) >= 128);
  assert.equal(issuedA.manageTokenHash.length, 64);
  assert.equal(issuedA.manageTokenHash, hashBookingManageToken(issuedA.token));
  assert.notEqual(issuedA.manageTokenHash, issuedA.token);
  assert.doesNotMatch(issuedA.token, /manageTokenHash/);

  const unique = new Set<string>();
  for (let i = 0; i < 64; i++) unique.add(generateBookingManageToken());
  assert.equal(unique.size, 64);
  for (const token of unique) {
    assert.ok(entropyBits(token) >= 128);
    assert.ok(token.length >= 40);
  }

  const bookingA = appointment({
    id: "eea_same_phone_a",
    firstName: "محمد",
    lastName: "خالد",
    phone: SAME_PHONE_E164,
    appointmentDate: "2026-10-15",
    appointmentTime: "10:00",
    manageTokenHash: issuedA.manageTokenHash,
    manageTokenExpiresAt: issuedA.manageTokenExpiresAt,
    manageTokenRevokedAt: null,
  });
  const bookingB = appointment({
    id: "eea_same_phone_b",
    firstName: "محمد",
    lastName: "خالد",
    phone: SAME_PHONE_E164,
    appointmentDate: "2026-10-20",
    appointmentTime: "16:00",
    language: "he",
    manageTokenHash: issuedB.manageTokenHash,
    manageTokenExpiresAt: issuedB.manageTokenExpiresAt,
    manageTokenRevokedAt: null,
  });
  assert.equal(bookingA.phone, bookingB.phone);
  assert.notEqual(bookingA.id, bookingB.id);
  assert.notEqual(bookingA.appointmentDate, bookingB.appointmentDate);

  const roster = [bookingA, bookingB];
  assert.equal(findAppointmentByManageTokenHash(roster, issuedA.token)?.id, bookingA.id);
  assert.equal(findAppointmentByManageTokenHash(roster, issuedB.token)?.id, bookingB.id);
  assert.equal(findAppointmentByManageTokenHash(roster, issuedA.token)?.id === bookingB.id, false);
  assert.equal(findAppointmentByManageTokenHash(roster, "not-a-real-token-value-here"), null);
  assert.equal(findAppointmentByManageTokenHash(roster, ""), null);
  assert.equal(findAppointmentByManageTokenHash(roster, "short"), null);
  assert.equal(
    findAppointmentByManageTokenHash(roster, SAME_PHONE),
    null,
    "phone number must never authorize manage access",
  );
  assert.equal(findAppointmentByManageTokenHash(roster, SAME_PHONE_E164), null);
  assert.equal(findAppointmentByManageTokenHash(roster, bookingA.id), null);
  assert.equal(findAppointmentByManageTokenHash(roster, bookingB.id), null);

  const viewA = publicManageAppointmentView(bookingA, "فحص نظر");
  assert.equal("id" in viewA, false);
  assert.equal("email" in viewA, false);
  assert.equal("phone" in viewA, false);
  assert.equal("manageTokenHash" in viewA, false);
  assert.equal("notes" in viewA, false);
  assert.equal(viewA.appointmentDate, "2026-10-15");
  const stripped = omitManageTokenSecrets(bookingA);
  assert.equal("manageTokenHash" in stripped, false);

  // ---------------------------------------------------------------------------
  // Valid / invalid / expired / revoked / cancelled
  // ---------------------------------------------------------------------------
  assert.equal(
    evaluateManageAccess(bookingA, new Date("2026-10-15T06:59:59.000Z")).ok,
    true,
  );
  const expiredA = evaluateManageAccess(bookingA, new Date("2026-10-15T07:00:00.000Z"));
  assert.equal(expiredA.ok, false);
  if (!expiredA.ok) assert.equal(expiredA.reason, "expired");
  assert.equal(
    evaluateManageAccess(bookingB, new Date("2026-10-15T07:00:00.000Z")).ok,
    true,
    "expiry of booking A must not expire booking B",
  );

  const cancelledA = {
    ...bookingA,
    status: "cancelled" as const,
    manageTokenRevokedAt: "2026-10-14T12:00:00.000Z",
  };
  const revokedA = evaluateManageAccess(cancelledA, new Date("2026-10-14T12:00:01.000Z"));
  assert.equal(revokedA.ok, false);
  if (!revokedA.ok) assert.equal(revokedA.reason, "revoked");
  assert.equal(canCustomerMutateBooking(cancelledA), false);
  assert.equal(canCustomerMutateBooking(bookingB), true);
  assert.equal(
    evaluateManageAccess(bookingB, new Date("2026-10-14T12:00:01.000Z")).ok,
    true,
    "revoking A must not revoke B",
  );
  assert.equal(canCustomerMutateBooking({ ...bookingA, status: "completed" }), false);

  // Asia/Jerusalem DST vs winter
  assert.equal(computeManageTokenExpiresAt("2026-10-15", "10:00"), "2026-10-15T07:00:00.000Z");
  assert.equal(computeManageTokenExpiresAt("2026-11-15", "10:00"), "2026-11-15T08:00:00.000Z");

  // ---------------------------------------------------------------------------
  // Independent WhatsApp confirmation variables for the same phone
  // ---------------------------------------------------------------------------
  resetTwilioContentSidMapForTests();
  process.env.TWILIO_WHATSAPP_CONTENT_SIDS = `oyon_booking_manage_v2_ar:HX${"a".repeat(32)},oyon_booking_manage_v2_he:HX${"b".repeat(32)}`;
  resetTwilioContentSidMapForTests();
  const newMode = mergeBookingMessages({
    customerConfirmation: {
      ...mergeBookingMessages(null).customerConfirmation,
      confirmationMode: "new",
    },
  });
  const planAr = resolveCustomerConfirmationTemplate(newMode, "ar", issuedA.token);
  const planHe = resolveCustomerConfirmationTemplate(newMode, "he", issuedB.token);
  assert.equal(planAr.useManageTemplate, true);
  assert.equal(planHe.useManageTemplate, true);
  assert.equal(planAr.templateName, "oyon_booking_manage_v2_ar");
  assert.equal(planHe.templateName, "oyon_booking_manage_v2_he");
  const varsA = buildManageTemplateContentVariables({
    customerName: "محمد خالد",
    serviceLabel: "فحص نظر",
    dateLabel: "15/10/26",
    time: "10:00",
    token: issuedA.token,
  });
  const varsB = buildManageTemplateContentVariables({
    customerName: "محمد خالد",
    serviceLabel: "בדיקת עיניים",
    dateLabel: "20/10/26",
    time: "16:00",
    token: issuedB.token,
  });
  assert.equal(varsA["5"], issuedA.token);
  assert.equal(varsB["5"], issuedB.token);
  assert.notEqual(varsA["5"], varsB["5"]);
  assert.notEqual(varsA["3"], varsB["3"]);

  const missingTokenPlan = resolveCustomerConfirmationTemplate(newMode, "ar");
  assert.equal(missingTokenPlan.skipReason, "missing-token");
  assert.deepEqual(planCustomerConfirmationSend(newMode, "ar"), []);

  // ---------------------------------------------------------------------------
  // Regeneration isolation + concurrent planner snapshots
  // ---------------------------------------------------------------------------
  const futureA = appointment({
    id: "eea_rot_a",
    firstName: "ليان",
    lastName: "عباس",
    appointmentDate: "2099-03-15",
    appointmentTime: "10:00",
    manageTokenHash: issuedA.manageTokenHash,
    manageTokenExpiresAt: "2099-03-15T08:00:00.000Z",
  });
  const futureB = appointment({
    id: "eea_rot_b",
    firstName: "ليان",
    lastName: "عباس",
    appointmentDate: "2099-03-20",
    appointmentTime: "16:00",
    manageTokenHash: issuedB.manageTokenHash,
    manageTokenExpiresAt: "2099-03-20T14:00:00.000Z",
  });
  const rotateA = planAdminManageLinkGeneration(futureA, { confirmRotate: true });
  assert.equal(rotateA.ok, true);
  if (!rotateA.ok) throw new Error("expected rotate A");
  assert.notEqual(rotateA.token, issuedA.token);
  assert.notEqual(rotateA.next.manageTokenHash, issuedA.manageTokenHash);
  assert.deepEqual(bookingIdentitySnapshot(rotateA.next), bookingIdentitySnapshot(futureA));
  assert.equal(findAppointmentByManageTokenHash([rotateA.next, futureB], issuedA.token), null);
  assert.equal(
    findAppointmentByManageTokenHash([rotateA.next, futureB], issuedB.token)?.id,
    futureB.id,
    "rotating A must leave B's token valid",
  );
  const needsConfirm = planAdminManageLinkGeneration(rotateA.next);
  assert.equal(needsConfirm.ok, false);
  if (!needsConfirm.ok) assert.equal(needsConfirm.error, "NEEDS_CONFIRM");

  const snap1 = planAdminManageLinkGeneration(rotateA.next, { confirmRotate: true });
  const snap2 = planAdminManageLinkGeneration(rotateA.next, { confirmRotate: true });
  assert.equal(snap1.ok && snap2.ok, true);
  if (snap1.ok && snap2.ok) {
    assert.notEqual(snap1.token, snap2.token);
    assert.notEqual(snap1.next.manageTokenHash, snap2.next.manageTokenHash);
  }

  const cancelledRotate = planAdminManageLinkGeneration(
    { ...futureA, status: "cancelled" },
    { confirmRotate: true },
  );
  assert.equal(cancelledRotate.ok, false);

  // ---------------------------------------------------------------------------
  // Slot conflict, cancelled occupancy, same-phone different dates
  // ---------------------------------------------------------------------------
  assert.equal(
    hasEyeExamSlotConflict(roster, "2026-10-15", "10:00"),
    true,
  );
  assert.equal(
    hasEyeExamSlotConflict(roster, "2026-10-20", "16:00"),
    true,
  );
  assert.equal(
    hasEyeExamSlotConflict(roster, "2026-10-21", "10:00"),
    false,
    "same phone on a different date/time is not a conflict",
  );
  assert.equal(
    hasEyeExamSlotConflict([cancelledA, bookingB], "2026-10-15", "10:00"),
    false,
  );
  assert.equal(isScheduledClinicBooking("cancelled"), false);

  // ---------------------------------------------------------------------------
  // Admin RBAC
  // ---------------------------------------------------------------------------
  assert.equal(hasPermission("admin", "settings"), true);
  assert.equal(hasPermission("admin", "appointments"), true);
  assert.equal(hasPermission("employee", "appointments"), true);
  assert.equal(hasPermission("employee", "settings"), false);
  assert.equal(hasPermission("receptionist", "appointments"), true);
  assert.equal(hasPermission("receptionist", "settings"), false);
  const manageLinkRoute = readFileSync(
    join(process.cwd(), "app/api/admin/eye-exam/appointments/manage-link/route.ts"),
    "utf8",
  );
  assert.match(manageLinkRoute, /role !== "admin"/);
  assert.match(manageLinkRoute, /requireSession/);
  assert.doesNotMatch(manageLinkRoute, /dispatchBookingMessages/);
  assert.doesNotMatch(manageLinkRoute, /sendSms/);
  const settingsRoute = readFileSync(
    join(process.cwd(), "app/api/settings/route.ts"),
    "utf8",
  );
  assert.match(settingsRoute, /requireSession\("settings"\)/);
  assert.match(settingsRoute, /mergeOwnerNotification/);
  assert.match(settingsRoute, /toPublicSettings/);

  // ---------------------------------------------------------------------------
  // Unauthorized notification destination / missing Twilio
  // ---------------------------------------------------------------------------
  const ownerSettings = mergeBookingMessages({
    ownerNotification: {
      ...mergeBookingMessages(null).ownerNotification,
      enabled: true,
      ownerWhatsApp: "+972509999999",
      testDestinationEnabled: true,
      testWhatsApp: "+972508888888",
    },
  });
  const dest = resolveOwnerNotificationDestination(ownerSettings);
  assert.equal(dest.source, "test");
  assert.equal(dest.to, "+972508888888");
  const preserved = mergeOwnerNotification(ownerSettings.ownerNotification, {
    testDestinationEnabled: true,
    ownerWhatsApp: "",
  });
  assert.equal(preserved.ownerWhatsApp, "+972509999999");
  assert.equal(customerConfirmationMode(mergeBookingMessages(null)), "original");
  assert.equal(customerConfirmationMode(newMode), "new");

  assert.equal(getTwilioConfig(), null);
  assert.equal(getTwilioWhatsAppPublicStatus().configured, false);
  const missingTwilio = await sendTwilioWhatsAppTemplate({
    to: SAME_PHONE_E164,
    templateName: "oyon_booking_manage_v2_ar",
    contentVariables: varsA,
  });
  assert.equal(missingTwilio.ok, false);
  assert.equal(missingTwilio.status, "skipped");
  assert.match(String(missingTwilio.error), /not configured/i);

  assert.equal(mapTwilioAcceptStatus("queued"), "queued");
  assert.equal(mapTwilioAcceptStatus("accepted"), "queued");
  assert.equal(mapTwilioAcceptStatus("sent"), "sent");
  assert.equal(mapTwilioAcceptStatus("delivered"), "sent");

  const alreadySentStore = {
    smsLogs: [
      {
        id: "sms_1",
        to: SAME_PHONE_E164,
        body: "WhatsApp:oyon_booking_manage_v2_ar",
        type: "appointment_confirmation" as const,
        status: "queued" as const,
        createdAt: "2026-10-01T00:00:00.000Z",
        appointmentId: bookingA.id,
      },
    ],
  };
  assert.equal(
    customerConfirmationAlreadySent(
      alreadySentStore as never,
      bookingA.id,
    ),
    true,
  );
  assert.equal(
    customerConfirmationAlreadySent(
      alreadySentStore as never,
      bookingB.id,
    ),
    false,
  );

  // ---------------------------------------------------------------------------
  // Rate limit + in-process lock
  // ---------------------------------------------------------------------------
  const limiterKey = `audit-${Date.now()}-${randomBytes(4).toString("hex")}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(limiterKey, 3, 60_000).ok, true);
  }
  assert.equal(rateLimit(limiterKey, 3, 60_000).ok, false);

  const order: number[] = [];
  await Promise.all([
    withEyeExamLock(async () => {
      order.push(1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push(2);
    }),
    withEyeExamLock(async () => {
      order.push(3);
    }),
  ]);
  assert.deepEqual(order, [1, 2, 3]);

  // ---------------------------------------------------------------------------
  // Isolated handler flow: two bookings, same phone
  // ---------------------------------------------------------------------------
  const seed = createSeedData();
  seed.eyeExamAppointments = [];
  seed.smsLogs = [];
  seed.activityLogs = [];
  beginIsolatedStore(seed);

  const firstSlot = pickPreviewTestSlot(seed);
  assert.ok(firstSlot, "seed clinic schedule should expose a bookable slot");

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
    return { status: response.status, body };
  }

  const firstBook = await bookCustomer({
    firstName: "محمد",
    lastName: "خالد",
    email: "same-phone-a@oyonoptics.invalid",
    phone: SAME_PHONE,
    language: "ar",
    date: firstSlot!.date,
    time: firstSlot!.time,
    type: firstSlot!.appointmentType,
  });
  assert.equal(firstBook.status, 201, String(firstBook.body.error || firstBook.status));
  const firstAppt = firstBook.body.appointment as {
    id: string;
    appointmentDate: string;
    appointmentTime: string;
    firstName: string;
  };
  const firstToken = takeE2EManageToken(firstAppt.id);
  assert.ok(firstToken);
  assert.equal("manageToken" in firstBook.body.appointment!, false);
  assert.equal("manageTokenHash" in firstBook.body.appointment!, false);
  assert.equal("phone" in firstBook.body.appointment!, false);
  assert.equal("email" in firstBook.body.appointment!, false);

  const storeAfterFirst = getIsolatedStore()!;
  const firstDay = storeAfterFirst.eyeExamAvailability.find(
    (item) => item.date === firstSlot!.date,
  );
  assert.ok(firstDay);
  const remainingSameDay = listBookableTimes(
    firstDay!,
    storeAfterFirst.eyeExamAppointments,
    { appointmentType: firstSlot!.appointmentType },
  );
  let secondDate = firstSlot!.date;
  let secondTime = remainingSameDay.find((time) => time !== firstSlot!.time) || "";
  if (!secondTime) {
    const laterDay = storeAfterFirst.eyeExamAvailability.find(
      (day) =>
        day.date > firstSlot!.date &&
        listBookableTimes(day, storeAfterFirst.eyeExamAppointments, {
          appointmentType: firstSlot!.appointmentType,
        }).length > 0,
    );
    assert.ok(laterDay, "need a second open clinic slot");
    secondDate = laterDay!.date;
    secondTime = listBookableTimes(laterDay!, storeAfterFirst.eyeExamAppointments, {
      appointmentType: firstSlot!.appointmentType,
    })[0];
  }

  const secondBook = await bookCustomer({
    firstName: "محمد",
    lastName: "خالد",
    email: "same-phone-b@oyonoptics.invalid",
    phone: SAME_PHONE,
    language: "he",
    date: secondDate,
    time: secondTime,
    type: firstSlot!.appointmentType,
  });
  assert.equal(
    secondBook.status,
    201,
    `same-phone second booking must succeed: ${String(secondBook.body.error || secondBook.status)}`,
  );
  const secondAppt = secondBook.body.appointment as {
    id: string;
    appointmentDate: string;
    appointmentTime: string;
  };
  const secondToken = takeE2EManageToken(secondAppt.id);
  assert.ok(secondToken);
  assert.notEqual(firstAppt.id, secondAppt.id);
  assert.notEqual(firstToken, secondToken);
  assert.notEqual(hashBookingManageToken(firstToken!), hashBookingManageToken(secondToken!));

  const liveRows = getIsolatedStore()!.eyeExamAppointments;
  assert.equal(liveRows.length, 2);
  assert.equal(liveRows.every((row) => row.phone === SAME_PHONE_E164), true);
  assert.equal(new Set(liveRows.map((row) => row.id)).size, 2);
  assert.equal(
    liveRows.every((row) => typeof row.manageTokenHash === "string" && !("manageToken" in row)),
    true,
  );
  assert.equal(getE2EOutbounds().length, 0, "isolated book must not send live WhatsApp/SMS");

  const getA = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": firstToken! },
    }),
  );
  const getB = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": secondToken! },
    }),
  );
  const viewBodyA = await readJson(getA);
  const viewBodyB = await readJson(getB);
  assert.equal(getA.status, 200);
  assert.equal(getB.status, 200);
  const shownA = viewBodyA.appointment as {
    appointmentDate: string;
    appointmentTime: string;
    customerName: string;
  };
  const shownB = viewBodyB.appointment as {
    appointmentDate: string;
    appointmentTime: string;
  };
  assert.equal(shownA.appointmentDate, firstAppt.appointmentDate);
  assert.equal(shownA.appointmentTime, firstAppt.appointmentTime);
  assert.equal(shownB.appointmentDate, secondAppt.appointmentDate);
  assert.equal(shownB.appointmentTime, secondAppt.appointmentTime);
  assert.notEqual(
    `${shownA.appointmentDate} ${shownA.appointmentTime}`,
    `${shownB.appointmentDate} ${shownB.appointmentTime}`,
  );
  assert.equal("phone" in shownA, false);
  assert.equal("email" in shownA, false);
  assert.equal("id" in shownA, false);
  assert.equal("manageTokenHash" in shownA, false);

  const invalidGet = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": "not-a-real-token-value-here-12345" },
    }),
  );
  assert.equal(invalidGet.status, 404);

  const phoneAuthGet = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": SAME_PHONE },
    }),
  );
  assert.equal(phoneAuthGet.status, 404);

  const idAuthGet = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": firstAppt.id },
    }),
  );
  assert.equal(idAuthGet.status, 404);

  const crossCancel = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": firstToken! },
      body: JSON.stringify({
        action: "cancel",
        id: secondAppt.id,
      }),
    }),
  );
  assert.equal(crossCancel.status, 200);
  const afterCross = getIsolatedStore()!.eyeExamAppointments;
  assert.equal(afterCross.find((row) => row.id === firstAppt.id)?.status, "cancelled");
  assert.equal(afterCross.find((row) => row.id === secondAppt.id)?.status, "confirmed");
  assert.ok(afterCross.find((row) => row.id === firstAppt.id)?.manageTokenRevokedAt);
  assert.equal(afterCross.find((row) => row.id === secondAppt.id)?.manageTokenRevokedAt, null);

  const cancelledGet = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": firstToken! },
    }),
  );
  assert.equal(cancelledGet.status, 410);
  const stillB = await manageGet(
    jsonRequest("http://localhost/api/booking/manage", {
      headers: { "x-booking-token": secondToken! },
    }),
  );
  assert.equal(stillB.status, 200);

  const duplicateCancel = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": firstToken! },
      body: JSON.stringify({ action: "cancel" }),
    }),
  );
  assert.equal(duplicateCancel.status, 410);

  const reactivate = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": firstToken! },
      body: JSON.stringify({ action: "reschedule", appointmentDate: secondDate, appointmentTime: secondTime }),
    }),
  );
  assert.equal(reactivate.status, 410);
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === firstAppt.id)?.status,
    "cancelled",
  );

  const laterTimes = listBookableTimes(
    getIsolatedStore()!.eyeExamAvailability.find((day) => day.date === secondDate)!,
    getIsolatedStore()!.eyeExamAppointments,
    { appointmentType: firstSlot!.appointmentType, includePastToday: true },
  ).filter((time) => time !== secondTime);
  const rescheduleTime = laterTimes[0];
  assert.ok(rescheduleTime, "need a free slot to reschedule booking B");

  const rescheduleB = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": secondToken! },
      body: JSON.stringify({
        action: "reschedule",
        appointmentDate: secondDate,
        appointmentTime: rescheduleTime,
      }),
    }),
  );
  assert.equal(rescheduleB.status, 200, String((await rescheduleB.clone().json() as { error?: string }).error || 200));
  const afterReschedule = getIsolatedStore()!.eyeExamAppointments;
  const rowA = afterReschedule.find((row) => row.id === firstAppt.id)!;
  const rowB = afterReschedule.find((row) => row.id === secondAppt.id)!;
  assert.equal(rowA.status, "cancelled");
  assert.equal(rowA.appointmentDate, firstAppt.appointmentDate);
  assert.equal(rowA.appointmentTime, firstAppt.appointmentTime);
  assert.equal(rowB.status, "confirmed");
  assert.equal(rowB.appointmentDate, secondDate);
  assert.equal(rowB.appointmentTime, rescheduleTime);
  assert.equal(rowB.manageTokenHash, hashBookingManageToken(secondToken!));

  const closedReschedule = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": secondToken! },
      body: JSON.stringify({
        action: "reschedule",
        appointmentDate: "1999-01-01",
        appointmentTime: "10:00",
      }),
    }),
  );
  assert.equal([400, 409].includes(closedReschedule.status), true);

  const rotateB = planAdminManageLinkGeneration(rowB, { confirmRotate: true });
  assert.equal(rotateB.ok, true);
  if (!rotateB.ok) throw new Error("expected rotate B");
  rowB.manageTokenHash = rotateB.next.manageTokenHash;
  rowB.manageTokenExpiresAt = rotateB.next.manageTokenExpiresAt;
  rowB.manageTokenRevokedAt = rotateB.next.manageTokenRevokedAt;
  assert.equal(findAppointmentByManageTokenHash(afterReschedule, secondToken!), null);
  assert.equal(findAppointmentByManageTokenHash(afterReschedule, rotateB.token)?.id, secondAppt.id);
  assert.equal(rowA.manageTokenHash, hashBookingManageToken(firstToken!));

  const takenSlot = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": rotateB.token },
      body: JSON.stringify({
        action: "reschedule",
        appointmentDate: rowB.appointmentDate,
        appointmentTime: rowB.appointmentTime,
      }),
    }),
  );
  assert.equal(takenSlot.status, 200);

  const [race1, race2] = await Promise.all([
    managePatch(
      jsonRequest("http://localhost/api/booking/manage", {
        method: "PATCH",
        headers: { "x-booking-token": rotateB.token },
        body: JSON.stringify({ action: "cancel" }),
      }),
    ),
    managePatch(
      jsonRequest("http://localhost/api/booking/manage", {
        method: "PATCH",
        headers: { "x-booking-token": rotateB.token },
        body: JSON.stringify({
          action: "reschedule",
          appointmentDate: firstSlot!.date,
          appointmentTime: firstSlot!.time,
        }),
      }),
    ),
  ]);
  const raceStatuses = [race1.status, race2.status];
  assert.ok(
    raceStatuses.includes(200),
    `concurrent cancel/reschedule must apply at least one write, got ${raceStatuses.join(",")}`,
  );
  const finalB = getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === secondAppt.id)!;
  assert.ok(
    finalB.status === "cancelled" || finalB.status === "confirmed",
    `booking B ended in unexpected status ${finalB.status}`,
  );
  assert.equal(finalB.id, secondAppt.id);
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === firstAppt.id)?.status,
    "cancelled",
  );
  if (finalB.status === "cancelled") {
    assert.ok(finalB.manageTokenRevokedAt);
  }

  const afterRace = getIsolatedStore()!;
  const reopenDay = afterRace.eyeExamAvailability.find((day) => {
    return listBookableTimes(day, afterRace.eyeExamAppointments, {
      appointmentType: firstSlot!.appointmentType,
      includePastToday: true,
    }).length > 0;
  });
  assert.ok(reopenDay, "a later same-phone booking should still have an open slot");
  const reopenTime = listBookableTimes(reopenDay!, afterRace.eyeExamAppointments, {
    appointmentType: firstSlot!.appointmentType,
    includePastToday: true,
  })[0];
  const thirdBook = await bookCustomer({
    firstName: "محمد",
    lastName: "خالد",
    email: "same-phone-c@oyonoptics.invalid",
    phone: SAME_PHONE,
    language: "ar",
    date: reopenDay!.date,
    time: reopenTime,
    type: firstSlot!.appointmentType,
  });
  assert.equal(
    thirdBook.status,
    201,
    `same phone must still be able to create another independent booking: ${String(thirdBook.body.error || thirdBook.status)}`,
  );
  const thirdAppt = thirdBook.body.appointment as { id: string };
  assert.notEqual(thirdAppt.id, firstAppt.id);
  assert.notEqual(thirdAppt.id, secondAppt.id);

  endIsolatedStore();

  // ---------------------------------------------------------------------------
  // Source inventory: clinic vs legacy appointment APIs
  // ---------------------------------------------------------------------------
  const bookRoute = readFileSync(join(process.cwd(), "app/api/eye-exam/book/route.ts"), "utf8");
  assert.match(bookRoute, /issueBookingManageToken/);
  assert.match(bookRoute, /manageTokenHash/);
  assert.doesNotMatch(bookRoute, /manageToken:/);
  assert.match(bookRoute, /normalizeIsraeliPhone/);
  assert.doesNotMatch(bookRoute, /find\(\s*\(.*phone/);
  assert.match(bookRoute, /hasEyeExamSlotConflict/);

  const manageApi = readFileSync(join(process.cwd(), "app/api/booking/manage/route.ts"), "utf8");
  assert.match(manageApi, /x-booking-token/);
  assert.match(manageApi, /rateLimit/);
  assert.doesNotMatch(manageApi, /searchParams\.get\("token"\)/);
  assert.match(manageApi, /findAppointmentByManageTokenHash/);
  assert.match(manageApi, /canCustomerMutateBooking/);
  assert.doesNotMatch(manageApi, /\botp\b/i);

  const appointmentsRoute = readFileSync(
    join(process.cwd(), "app/api/appointments/route.ts"),
    "utf8",
  );
  assert.match(
    appointmentsRoute,
    /searchParams\.get\("token"\)/,
    "legacy appointments API still exposes unauthenticated token lookup",
  );
  assert.match(appointmentsRoute, /manageToken: newId\("tok"\)/);
  assert.match(appointmentsRoute, /a\.manageToken === token/);

  const webhook = readFileSync(
    join(process.cwd(), "app/api/whatsapp/webhook/route.ts"),
    "utf8",
  );
  assert.match(webhook, /\[WhatsApp Webhook RAW\]/);
  assert.doesNotMatch(webhook, /X-Hub-Signature|hub_signature|hmac/i);

  const authSrc = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8");
  assert.match(authSrc, /lumina-dev-secret-change-me/);
  assert.match(authSrc, /oyon2024/);

  const helpers = readFileSync(join(process.cwd(), "lib/api/helpers.ts"), "utf8");
  assert.match(helpers, /error instanceof Error \? error\.message/);

  const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  assert.match(middleware, /isCustomerManagePath/);
  assert.match(middleware, /Referrer-Policy/);
  assert.match(middleware, /no-store/);

  const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(nextConfig, /\/appointments\/manage/);
  assert.match(nextConfig, /\/booking\/manage/);
  assert.match(nextConfig, /\/api\/booking\/manage/);

  const twilioConfig = readFileSync(join(process.cwd(), "lib/twilio/config.ts"), "utf8");
  assert.match(twilioConfig, /process\.env\[name\]/);
  assert.doesNotMatch(
    readFileSync(join(process.cwd(), "app/api/settings/route.ts"), "utf8"),
    /TWILIO_AUTH_TOKEN/,
  );

  const weakLegacyId = newId("tok");
  assert.match(weakLegacyId, /^tok_[0-9a-f]{16}$/);
  assert.equal(Buffer.from(weakLegacyId.slice(4), "hex").length * 8, 64);

  const sha = createHash("sha256").update("probe", "utf8").digest("hex");
  assert.equal(sha.length, 64);

  assert.equal(
    shouldDispatchBookingMessages(bookingA, "e2e", "test"),
    false,
  );

  console.log("booking-security tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
