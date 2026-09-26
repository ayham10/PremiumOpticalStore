import assert from "node:assert/strict";
import {
  applyRestoreCategories,
  parseBackupId,
  parseRestoreCategories,
  restoreCategoryCount,
  unselectedFieldsMatch,
} from "../lib/restore-apply";
import {
  executeRestore,
  previewRestore,
  resetRestoreInFlightForTests,
} from "../lib/restore";
import type { AppData } from "../lib/types";

function sampleApp(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    products: [
      {
        id: "p1",
        slug: "a",
        name: "Live frame",
        category: "frames",
        brand: "OYON",
        sku: "L1",
        description: "",
        images: ["https://example.com/live.jpg"],
        purchasePrice: 1,
        sellingPrice: 2,
        stockQuantity: 4,
        minimumStock: 1,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    appointments: [
      {
        id: "legacy-1",
        service: "eye-exam",
        staffId: "s1",
        customerId: "c1",
        customerName: "Live",
        customerEmail: "a@b.c",
        customerPhone: "1",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: "10:30",
        status: "confirmed",
        manageToken: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    customers: [{ id: "c1", name: "Live customer" } as AppData["customers"][number],
    ],
    staff: [{ id: "s1" } as AppData["staff"][number]],
    suppliers: [],
    promotions: [{ id: "pr1" } as AppData["promotions"][number]],
    media: [{ id: "m1", url: "https://example.com/x.jpg" } as AppData["media"][number]],
    reviews: [],
    contactMessages: [],
    smsLogs: [],
    activityLogs: [],
    holidays: [{ id: "h1" } as AppData["holidays"][number]],
    availability: [{ id: "av1" } as AppData["availability"][number]],
    eyeExamAvailability: [{ id: "eea1" } as AppData["eyeExamAvailability"][number]],
    eyeExamAppointments: [
      { id: "b1" } as AppData["eyeExamAppointments"][number],
      { id: "b2" } as AppData["eyeExamAppointments"][number],
    ],
    bookingServices: [{ id: "svc1" } as AppData["bookingServices"][number]],
    lensInventory: [
      {
        type: "minus",
        sph: "-1.00",
        cyl: "0.00",
        currentStock: 3,
        desiredStock: 5,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    settings: {
      storeName: "Live",
      tagline: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      whatsapp: "",
      googleMapsEmbedUrl: "",
      googleMapsLink: "",
      openingHours: [],
      social: {},
      seo: { title: "", description: "", keywords: "" },
      smtp: {},
      sms: { provider: "console", enabled: false },
      bookingMessages: {} as AppData["settings"]["bookingMessages"],
      appointmentSlotMinutes: 30,
      bookingLeadDays: 1,
      currency: "ILS",
      currencySymbol: "₪",
      servicePages: { eyeExam: { title: "Live exam" } } as AppData["settings"]["servicePages"],
    },
    updatedAt: "2026-09-26T12:00:00.000Z",
    ...overrides,
  };
}

const live = sampleApp();
const backup = sampleApp({
  products: [
    {
      ...live.products[0],
      id: "p9",
      slug: "old",
      stockQuantity: 99,
    },
  ],
  appointments: [{ ...live.appointments[0], id: "legacy-old" }],
  customers: [{ ...live.customers[0], id: "c-old" }],
  promotions: [
    { ...live.promotions[0], id: "pr-old" },
    { ...live.promotions[0], id: "pr-old-2" },
  ],
  media: [{ ...live.media[0], id: "m-old" }],
  holidays: [{ ...live.holidays[0], id: "h-old" }],
  eyeExamAppointments: [{ ...live.eyeExamAppointments[0], id: "b-old" }],
  lensInventory: [
    {
      type: "plus",
      sph: "+1.00",
      cyl: "-0.25",
      currentStock: 8,
      desiredStock: 8,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  settings: {
    ...live.settings,
    storeName: "Backup",
    servicePages: {
      ...live.settings.servicePages,
      eyeExam: {
        ...live.settings.servicePages!.eyeExam,
        title: "Old exam",
      },
    },
  },
  updatedAt: "2026-01-01T00:00:00.000Z",
});

assert.throws(() => parseRestoreCategories(["customers"]), /RESTORE_CATEGORY_INVALID/);
assert.throws(() => parseRestoreCategories([]), /RESTORE_CATEGORIES_REQUIRED/);
assert.throws(() => parseBackupId("store/daily/2026-09-26.json"), /RESTORE_BACKUP_INVALID/);
assert.deepEqual(parseBackupId("manual:2026-09-26T19:00:10.289Z"), {
  kind: "manual",
  createdAt: "2026-09-26T19:00:10.289Z",
});

const restoredBookings = applyRestoreCategories(live, backup, ["bookings"]);
assert.equal(restoredBookings.eyeExamAppointments[0].id, "b-old");
assert.equal(restoredBookings.appointments[0].id, "legacy-old");
assert.equal(restoredBookings.products[0].id, "p1");
assert.equal(restoredBookings.products[0].stockQuantity, 4);
assert.equal(restoredBookings.lensInventory[0].currentStock, 3);
assert.equal(restoredBookings.settings.storeName, "Live");
assert.equal(restoredBookings.promotions[0].id, "pr1");
assert.equal(restoredBookings.customers[0].id, "c1");
assert.equal(restoredBookings.media[0].id, "m1");
assert.equal(restoredBookings.holidays[0].id, "h1");
assert.equal(restoredBookings.bookingServices[0].id, "svc1");
assert.ok(unselectedFieldsMatch(live, restoredBookings, ["bookings"]));

const restoredProducts = applyRestoreCategories(live, backup, ["products"]);
assert.equal(restoredProducts.products[0].stockQuantity, 99);
assert.equal(restoredProducts.eyeExamAppointments.length, 2);
assert.ok(unselectedFieldsMatch(live, restoredProducts, ["products"]));

assert.equal(restoreCategoryCount(live, "bookings"), 2);
assert.equal(restoreCategoryCount(backup, "promotions"), 2);

async function run() {
resetRestoreInFlightForTests();
let wrote = 0;
const snapshot = {
  purpose: "manual" as const,
  createdAt: "2026-09-26T19:00:10.289Z",
  appData: backup,
};
const goodDeps = {
  loadSnapshot: async () => snapshot as never,
  readLive: async () => ({
    payload: structuredClone(live),
    updatedAt: live.updatedAt,
    payloadBytes: 1,
  }),
  createPreRestore: async () => ({ ok: true, complete: true }) as never,
  writeLive: async () => {
    wrote += 1;
  },
};

const preview = await previewRestore(
  "manual:2026-09-26T19:00:10.289Z",
  ["bookings"],
  goodDeps,
);
assert.equal(preview.sections[0].liveCount, 2);
assert.equal(preview.sections[0].backupCount, 1);
assert.equal(wrote, 0);

await assert.rejects(
  () =>
    executeRestore(
      "manual:2026-09-26T19:00:10.289Z",
      ["bookings"],
      false,
      goodDeps,
    ),
  /RESTORE_CONFIRM_REQUIRED/,
);
assert.equal(wrote, 0);

await assert.rejects(
  () =>
    executeRestore("manual:2026-09-26T19:00:10.289Z", ["bookings"], true, {
      ...goodDeps,
      createPreRestore: async () => ({ ok: false, complete: false }) as never,
    }),
  /RESTORE_PRE_SNAPSHOT_FAILED/,
);
assert.equal(wrote, 0);

await assert.rejects(
  () =>
    executeRestore("manual:2026-09-26T19:00:10.289Z", ["bookings"], true, {
      ...goodDeps,
      loadSnapshot: async () => null,
    }),
  /RESTORE_BACKUP_NOT_FOUND/,
);

await assert.rejects(
  () =>
    executeRestore("manual:2026-09-26T19:00:10.289Z", ["bookings"], true, {
      ...goodDeps,
      loadSnapshot: async () => ({ ...snapshot, purpose: "pre-restore" }) as never,
    }),
  /RESTORE_BACKUP_NOT_RESTORABLE/,
);

const ok = await executeRestore(
  "manual:2026-09-26T19:00:10.289Z",
  ["lenses"],
  true,
  goodDeps,
);
assert.equal(ok.ok, true);
assert.equal(wrote, 1);

console.log(
  JSON.stringify({ isolated: "pass", wrote, previewWrites: 0 }, null, 2),
);
}

void run();
