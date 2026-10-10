/**
 * Isolated remediations for audit PR #65 High/Medium findings.
 * Uses fixtures and the isolated E2E store. Never writes production data
 * or sends WhatsApp.
 */
process.env.BOOKING_E2E_ISOLATED = "1";
process.env.VERCEL_ENV = "e2e";
process.env.SMS_PROVIDER = "console";
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_WHATSAPP_FROM;

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { randomBytes } = await import("node:crypto");

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
    generateBookingManageToken,
    hashBookingManageToken,
    issueBookingManageToken,
  } = await import("../lib/booking-manage-token");
  const { hasPermission, setTestSession, authenticateUser } = await import(
    "../lib/auth"
  );
  const {
    generateLegacyAppointmentManageToken,
    toStaffAppointmentView,
  } = await import("../lib/appointment-access");
  const { handleRouteError } = await import("../lib/api/helpers");
  const { listBookableTimes } = await import("../lib/eye-exam");
  const {
    signTwilioForm,
    signTwilioRawBody,
    signMetaRawBody,
    verifyIncomingWebhook,
  } = await import("../lib/twilio/webhook-signature");
  const {
    GET: appointmentsGet,
    POST: appointmentsPost,
    PATCH: appointmentsPatch,
    DELETE: appointmentsDelete,
  } = await import("../app/api/appointments/route");
  const { POST: loginPost } = await import("../app/api/auth/login/route");
  const {
    GET: webhookGet,
    POST: webhookPost,
  } = await import("../app/api/whatsapp/webhook/route");
  const { POST: bookPost } = await import("../app/api/eye-exam/book/route");
  const { GET: manageGet, PATCH: managePatch } = await import(
    "../app/api/booking/manage/route"
  );

  const SAME_PHONE = "0501234567";
  const SAME_PHONE_E164 = "+972501234567";
  const LEGACY_TOKEN = "tok_oldlegacyvalue";

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

  function adminSession(
    role: "admin" | "employee" | "receptionist" = "admin",
  ) {
    return {
      id: `staff-${role}`,
      name: role,
      email: `${role}@oyon.optics`,
      role,
    };
  }

  function futureDate(daysAhead = 3): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().slice(0, 10);
  }

  function legacyAppointment() {
    const now = new Date().toISOString();
    return {
      id: "apt_legacy_keep",
      service: "Eye Examination" as const,
      staffId: "staff-maya",
      customerId: "cus_legacy",
      customerName: "Legacy Customer",
      customerEmail: "legacy@oyonoptics.invalid",
      customerPhone: "0509990000",
      date: futureDate(4),
      startTime: "11:00",
      endTime: "11:30",
      status: "confirmed" as const,
      notes: "keep-token",
      manageToken: LEGACY_TOKEN,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ---------------------------------------------------------------------------
  // Source / helper assertions
  // ---------------------------------------------------------------------------
  const appointmentsSource = readFileSync(
    join(process.cwd(), "app/api/appointments/route.ts"),
    "utf8",
  );
  assert.match(appointmentsSource, /await requireSession\("appointments"\)/);
  assert.match(appointmentsSource, /toStaffAppointmentView/);
  assert.match(appointmentsSource, /generateLegacyAppointmentManageToken/);
  assert.doesNotMatch(appointmentsSource, /searchParams\.get\("token"\)/);
  assert.doesNotMatch(appointmentsSource, /a\.manageToken === token/);
  assert.doesNotMatch(appointmentsSource, /newId\("tok"\)/);
  assert.doesNotMatch(appointmentsSource, /public_booking/);

  const webhookSource = readFileSync(
    join(process.cwd(), "app/api/whatsapp/webhook/route.ts"),
    "utf8",
  );
  assert.match(webhookSource, /verifyIncomingWebhook/);
  assert.doesNotMatch(webhookSource, /Webhook RAW/);
  assert.doesNotMatch(webhookSource, /JSON\.stringify\(payload/);
  assert.doesNotMatch(webhookSource, /recipientId:/);

  const authSource = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8");
  assert.match(authSource, /AUTH_SECRET_MISSING/);
  assert.match(authSource, /isProductionRuntime/);
  assert.match(authSource, /configuredPassword/);

  const loginSource = readFileSync(
    join(process.cwd(), "app/api/auth/login/route.ts"),
    "utf8",
  );
  assert.match(loginSource, /rateLimit/);
  assert.match(loginSource, /admin-login/);

  const helpersSource = readFileSync(
    join(process.cwd(), "lib/api/helpers.ts"),
    "utf8",
  );
  assert.match(helpersSource, /Internal server error/);
  assert.doesNotMatch(
    helpersSource,
    /error instanceof Error \? error\.message : "Internal server error"/,
  );

  const enDict = readFileSync(
    join(process.cwd(), "lib/i18n/dictionaries/en.ts"),
    "utf8",
  );
  const arDict = readFileSync(
    join(process.cwd(), "lib/i18n/dictionaries/ar.ts"),
    "utf8",
  );
  const heDict = readFileSync(
    join(process.cwd(), "lib/i18n/dictionaries/he.ts"),
    "utf8",
  );
  assert.doesNotMatch(enDict, /oyon2024|employee2024|reception2024/);
  assert.doesNotMatch(arDict, /oyon2024|employee2024|reception2024/);
  assert.doesNotMatch(heDict, /oyon2024|employee2024|reception2024/);

  const strong = generateLegacyAppointmentManageToken();
  const strongB = generateLegacyAppointmentManageToken();
  assert.notEqual(strong, strongB);
  assert.ok(Buffer.from(strong, "base64url").length >= 32);
  const view = toStaffAppointmentView(legacyAppointment(), "Maya Cohen");
  assert.equal("manageToken" in view, false);
  assert.equal(view.staffName, "Maya Cohen");
  assert.equal(view.id, "apt_legacy_keep");

  const clinicToken = generateBookingManageToken();
  assert.ok(Buffer.from(clinicToken, "base64url").length >= 32);
  assert.notEqual(hashBookingManageToken(clinicToken), clinicToken);

  assert.equal(hasPermission("admin", "appointments"), true);
  assert.equal(hasPermission("employee", "appointments"), true);
  assert.equal(hasPermission("receptionist", "appointments"), true);
  assert.equal(hasPermission("admin", "settings"), true);
  assert.equal(hasPermission("employee", "settings"), false);
  assert.equal(hasPermission("receptionist", "settings"), false);

  const leaked = handleRouteError(new Error("ECONNREFUSED supabase secret=abc"));
  const leakedBody = await readJson(leaked);
  assert.equal(leaked.status, 500);
  assert.equal(leakedBody.error, "Internal server error");
  assert.equal(String(leakedBody.error).includes("ECONNREFUSED"), false);
  assert.equal(String(leakedBody.error).includes("secret="), false);

  const unauthorized = handleRouteError(new Error("UNAUTHORIZED"));
  assert.equal(unauthorized.status, 401);

  // ---------------------------------------------------------------------------
  // Production auth fail-closed + configured accounts
  // ---------------------------------------------------------------------------
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    EMPLOYEE_PASSWORD: process.env.EMPLOYEE_PASSWORD,
    RECEPTIONIST_PASSWORD: process.env.RECEPTIONIST_PASSWORD,
  };

  function restoreAuthEnv() {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    process.env.VERCEL_ENV = "e2e";
    process.env.BOOKING_E2E_ISOLATED = "1";
  }

  delete process.env.AUTH_SECRET;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.EMPLOYEE_PASSWORD;
  delete process.env.RECEPTIONIST_PASSWORD;
  process.env.NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
  assert.equal(authenticateUser("admin@oyon.optics", "oyon2024"), null);
  assert.equal(authenticateUser("employee@oyon.optics", "employee2024"), null);
  assert.equal(
    authenticateUser("receptionist@oyon.optics", "reception2024"),
    null,
  );

  process.env.AUTH_SECRET = "test-production-secret-not-for-use";
  process.env.ADMIN_PASSWORD = "configured-admin-password";
  process.env.ADMIN_EMAIL = "admin@oyon.optics";
  process.env.EMPLOYEE_PASSWORD = "configured-employee-password";
  process.env.RECEPTIONIST_PASSWORD = "configured-reception-password";
  const configuredAdmin = authenticateUser(
    "admin@oyon.optics",
    "configured-admin-password",
  );
  assert.ok(configuredAdmin);
  assert.equal(configuredAdmin?.role, "admin");
  assert.equal(authenticateUser("admin@oyon.optics", "oyon2024"), null);
  assert.ok(
    authenticateUser("employee@oyon.optics", "configured-employee-password"),
  );
  assert.ok(
    authenticateUser(
      "receptionist@oyon.optics",
      "configured-reception-password",
    ),
  );
  restoreAuthEnv();

  // ---------------------------------------------------------------------------
  // Login rate limit
  // ---------------------------------------------------------------------------
  const loginEmail = `rate-limit-${randomBytes(4).toString("hex")}@oyon.optics`;
  let lastLogin: Response | null = null;
  for (let i = 0; i < 6; i++) {
    lastLogin = await loginPost(
      jsonRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ email: loginEmail, password: "wrong-password" }),
      }),
    );
  }
  assert.ok(lastLogin);
  assert.equal(lastLogin!.status, 429);
  const limitedBody = await readJson(lastLogin!);
  assert.match(String(limitedBody.error), /too many login attempts/i);

  // ---------------------------------------------------------------------------
  // Webhook signature: negative + positive
  // ---------------------------------------------------------------------------
  process.env.TWILIO_AUTH_TOKEN = "test-twilio-auth-token";
  process.env.WHATSAPP_APP_SECRET = "test-meta-app-secret";
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "test-meta-verify";

  const webhookUrl = "http://localhost/api/whatsapp/webhook";
  const twilioParams = {
    MessageSid: "SM1234567890abcdef1234567890abcdef",
    MessageStatus: "delivered",
    To: "whatsapp:+972501234567",
    From: "whatsapp:+14155238886",
  };
  const twilioBody = new URLSearchParams(twilioParams).toString();
  const twilioSig = signTwilioForm(
    "test-twilio-auth-token",
    webhookUrl,
    twilioParams,
  );

  const missingSig = await webhookPost(
    new Request(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
    }),
  );
  assert.equal(missingSig.status, 403);

  const badTwilio = await webhookPost(
    new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "aaaaaaaaaaaaaaaaaaaaaaaaaaa=",
      },
      body: twilioBody,
    }),
  );
  assert.equal(badTwilio.status, 403);

  const goodTwilio = await webhookPost(
    new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": twilioSig,
      },
      body: twilioBody,
    }),
  );
  const goodTwilioBody = await readJson(goodTwilio);
  assert.equal(goodTwilio.status, 200, String(goodTwilioBody.error || 200));
  assert.equal(goodTwilioBody.source, "twilio");
  assert.equal(goodTwilioBody.processed, 1);

  const metaPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [{ id: "wamid.abc", status: "delivered", timestamp: "1" }],
            },
          },
        ],
      },
    ],
  };
  const metaRaw = JSON.stringify(metaPayload);
  const metaSig = signMetaRawBody("test-meta-app-secret", metaRaw);
  const goodMeta = await webhookPost(
    new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": metaSig,
      },
      body: metaRaw,
    }),
  );
  const goodMetaBody = await readJson(goodMeta);
  assert.equal(goodMeta.status, 200);
  assert.equal(goodMetaBody.source, "meta");
  assert.equal(goodMetaBody.processed, 1);

  const badMeta = await webhookPost(
    new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      body: metaRaw,
    }),
  );
  assert.equal(badMeta.status, 403);

  const verifyGet = await webhookGet(
    new Request(
      `${webhookUrl}?hub.mode=subscribe&hub.verify_token=test-meta-verify&hub.challenge=ok-challenge`,
    ),
  );
  assert.equal(verifyGet.status, 200);
  assert.equal(await verifyGet.text(), "ok-challenge");

  const badVerify = await webhookGet(
    new Request(
      `${webhookUrl}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=nope`,
    ),
  );
  assert.equal(badVerify.status, 403);

  const jsonTwilioBody = JSON.stringify({ MessageSid: "SMJSON" });
  const jsonTwilioSig = signTwilioRawBody(
    "test-twilio-auth-token",
    webhookUrl,
    jsonTwilioBody,
  );
  const verifiedJson = verifyIncomingWebhook(
    new Request(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-twilio-signature": jsonTwilioSig,
      },
      body: jsonTwilioBody,
    }),
    jsonTwilioBody,
  );
  assert.equal(verifiedJson.ok, true);

  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  // ---------------------------------------------------------------------------
  // Legacy appointments API: authz, token omission, existing token keep
  // ---------------------------------------------------------------------------
  const seed = createSeedData();
  seed.appointments = [legacyAppointment()];
  seed.smsLogs = [];
  seed.activityLogs = [];
  beginIsolatedStore(seed);

  setTestSession(null);
  const unauthGet = await appointmentsGet(
    jsonRequest("http://localhost/api/appointments?token=" + LEGACY_TOKEN),
  );
  assert.equal(unauthGet.status, 401);
  const unauthGetBody = await readJson(unauthGet);
  assert.equal("appointment" in unauthGetBody, false);
  assert.equal("manageToken" in unauthGetBody, false);

  const unauthPost = await appointmentsPost(
    jsonRequest("http://localhost/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        service: "Eye Examination",
        staffId: "staff-maya",
        date: futureDate(),
        startTime: "10:00",
        customerName: "Public User",
        customerEmail: "public@oyonoptics.invalid",
        customerPhone: SAME_PHONE,
      }),
    }),
  );
  assert.equal(unauthPost.status, 401);

  const unauthPatch = await appointmentsPatch(
    jsonRequest("http://localhost/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({ token: LEGACY_TOKEN, status: "cancelled" }),
    }),
  );
  assert.equal(unauthPatch.status, 401);
  assert.equal(getIsolatedStore()!.appointments[0].status, "confirmed");
  assert.equal(getIsolatedStore()!.appointments[0].manageToken, LEGACY_TOKEN);

  const unauthDelete = await appointmentsDelete(
    jsonRequest("http://localhost/api/appointments?token=" + LEGACY_TOKEN, {
      method: "DELETE",
    }),
  );
  assert.equal(unauthDelete.status, 401);

  for (const role of ["admin", "employee", "receptionist"] as const) {
    setTestSession(adminSession(role));
    const list = await appointmentsGet(jsonRequest("http://localhost/api/appointments"));
    assert.equal(list.status, 200, `${role} should list appointments`);
    const listed = await readJson(list);
    const rows = listed.appointments as Array<Record<string, unknown>>;
    assert.equal(Array.isArray(rows), true);
    assert.equal(rows.length, 1);
    assert.equal("manageToken" in rows[0], false);
    assert.equal(rows[0].id, "apt_legacy_keep");
    assert.equal(rows[0].customerName, "Legacy Customer");
  }

  setTestSession(adminSession("admin"));
  const patched = await appointmentsPatch(
    jsonRequest("http://localhost/api/appointments", {
      method: "PATCH",
      body: JSON.stringify({
        id: "apt_legacy_keep",
        notes: "staff updated",
        sendSms: false,
      }),
    }),
  );
  const patchedBody = await readJson(patched);
  assert.equal(patched.status, 200, String(patchedBody.error || 200));
  assert.equal("manageToken" in (patchedBody.appointment as object), false);
  assert.equal(getIsolatedStore()!.appointments[0].manageToken, LEGACY_TOKEN);
  assert.equal(getIsolatedStore()!.appointments[0].notes, "staff updated");
  assert.equal(getIsolatedStore()!.appointments[0].status, "confirmed");

  const created = await appointmentsPost(
    jsonRequest("http://localhost/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        service: "Eye Examination",
        staffId: "staff-maya",
        date: futureDate(5),
        startTime: "14:00",
        customerName: "Staff Created",
        customerEmail: "staff-created@oyonoptics.invalid",
        customerPhone: "0501112222",
        status: "confirmed",
      }),
    }),
  );
  const createdBody = await readJson(created);
  assert.equal(created.status, 201, String(createdBody.error || 201));
  const createdAppt = createdBody.appointment as { id: string };
  assert.equal("manageToken" in createdAppt, false);
  const storedCreated = getIsolatedStore()!.appointments.find(
    (row) => row.id === createdAppt.id,
  );
  assert.ok(storedCreated);
  assert.notEqual(storedCreated!.manageToken, LEGACY_TOKEN);
  assert.ok(Buffer.from(storedCreated!.manageToken, "base64url").length >= 32);
  assert.equal(
    getIsolatedStore()!.appointments.find((row) => row.id === "apt_legacy_keep")
      ?.manageToken,
    LEGACY_TOKEN,
    "creating a new staff row must not rewrite existing tokens",
  );

  const tokenCreateStillBlocked = await appointmentsGet(
    jsonRequest("http://localhost/api/appointments?token=" + storedCreated!.manageToken),
  );
  const tokenCreateBody = await readJson(tokenCreateStillBlocked);
  assert.equal(tokenCreateStillBlocked.status, 200);
  assert.equal("appointment" in tokenCreateBody, false);
  assert.equal(Array.isArray(tokenCreateBody.appointments), true);

  setTestSession({
    id: "no-role",
    name: "none",
    email: "none@oyon.optics",
    role: "employee",
  });
  // receptionist/employee already covered; unknown permission via settings-only check
  assert.equal(hasPermission("receptionist", "delete"), false);

  setTestSession(null);
  endIsolatedStore();

  // ---------------------------------------------------------------------------
  // Clinic booking + manage regressions (hashed tokens, same phone)
  // ---------------------------------------------------------------------------
  const clinicSeed = createSeedData();
  clinicSeed.eyeExamAppointments = [];
  clinicSeed.smsLogs = [];
  clinicSeed.activityLogs = [];
  beginIsolatedStore(clinicSeed);
  const firstSlot = pickPreviewTestSlot(clinicSeed);
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
    return { status: response.status, body: await readJson(response) };
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
  };
  const firstToken = takeE2EManageToken(firstAppt.id);
  assert.ok(firstToken);
  assert.equal("manageToken" in firstBook.body.appointment!, false);
  assert.equal("manageTokenHash" in firstBook.body.appointment!, false);

  const afterFirst = getIsolatedStore()!;
  const firstDay = afterFirst.eyeExamAvailability.find(
    (item) => item.date === firstSlot!.date,
  );
  const remainingSameDay = listBookableTimes(
    firstDay!,
    afterFirst.eyeExamAppointments,
    { appointmentType: firstSlot!.appointmentType },
  );
  let secondDate = firstSlot!.date;
  let secondTime = remainingSameDay.find((time) => time !== firstSlot!.time) || "";
  if (!secondTime) {
    const laterDay = afterFirst.eyeExamAvailability.find(
      (day) =>
        day.date > firstSlot!.date &&
        listBookableTimes(day, afterFirst.eyeExamAppointments, {
          appointmentType: firstSlot!.appointmentType,
        }).length > 0,
    );
    assert.ok(laterDay, "need a second open clinic slot");
    secondDate = laterDay!.date;
    secondTime = listBookableTimes(laterDay!, afterFirst.eyeExamAppointments, {
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
  assert.equal(secondBook.status, 201, String(secondBook.body.error || 201));
  const secondAppt = secondBook.body.appointment as { id: string };
  const secondToken = takeE2EManageToken(secondAppt.id);
  assert.ok(secondToken);
  assert.notEqual(firstToken, secondToken);
  assert.equal(getE2EOutbounds().length, 0, "isolated book must not send live WhatsApp");

  const liveRows = getIsolatedStore()!.eyeExamAppointments;
  assert.equal(liveRows.length, 2);
  assert.equal(liveRows.every((row) => row.phone === SAME_PHONE_E164), true);
  const firstHash = liveRows.find((row) => row.id === firstAppt.id)!.manageTokenHash;
  assert.equal(firstHash, hashBookingManageToken(firstToken!));

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
  assert.equal(getA.status, 200);
  assert.equal(getB.status, 200);
  const shownA = (await readJson(getA)).appointment as {
    appointmentDate: string;
    appointmentTime: string;
  };
  assert.equal(shownA.appointmentDate, firstAppt.appointmentDate);
  assert.equal("phone" in shownA, false);
  assert.equal("manageTokenHash" in shownA, false);

  const laterTimes = listBookableTimes(
    getIsolatedStore()!.eyeExamAvailability.find((day) => day.date === secondDate)!,
    getIsolatedStore()!.eyeExamAppointments,
    { appointmentType: firstSlot!.appointmentType, includePastToday: true },
  ).filter((time) => time !== secondTime);
  const rescheduleTime = laterTimes[0];
  assert.ok(rescheduleTime);

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
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === firstAppt.id)
      ?.status,
    "confirmed",
  );
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === secondAppt.id)
      ?.appointmentTime,
    rescheduleTime,
  );

  const cancelA = await managePatch(
    jsonRequest("http://localhost/api/booking/manage", {
      method: "PATCH",
      headers: { "x-booking-token": firstToken! },
      body: JSON.stringify({ action: "cancel" }),
    }),
  );
  assert.equal(cancelA.status, 200);
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === firstAppt.id)
      ?.status,
    "cancelled",
  );
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === secondAppt.id)
      ?.status,
    "confirmed",
  );
  assert.equal(
    getIsolatedStore()!.eyeExamAppointments.find((row) => row.id === firstAppt.id)
      ?.manageTokenHash,
    firstHash,
    "cancel must not rewrite the stored clinic hash",
  );

  const issued = issueBookingManageToken("2026-10-15", "10:00", 30);
  assert.ok(Buffer.from(issued.token, "base64url").length >= 32);
  assert.equal(issued.manageTokenExpiresAt, "2026-10-15T07:00:00.000Z");

  endIsolatedStore();
  setTestSession(undefined);

  console.log("test-booking-security-remediation: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
