import assert from "node:assert/strict";
import type { AppData, CatalogCategory, CustomServicePage, Product } from "../lib/types";
import {
  applyRestorePlan,
  parseRestoreRequest,
  unchangedOutsidePlan,
  validateRestorableAppData,
} from "../lib/restore-plan";
import { collectReferencedMediaPaths, restoreMissingMedia } from "../lib/restore-media";
import {
  executeRestore,
  executeRestoreRequest,
  isLiveRestoreAllowed,
  previewRestore,
  previewRestoreRequest,
  resetRestoreInFlightForTests,
} from "../lib/restore";

function product(
  partial: Partial<Product> & Pick<Product, "id" | "category">,
): Product {
  return {
    slug: partial.id,
    name: partial.name || partial.id,
    brand: "OYON",
    sku: partial.id,
    description: "",
    images: [
      "https://example.supabase.co/storage/v1/object/public/lumina-media/products/live.jpg",
    ],
    purchasePrice: 1,
    sellingPrice: 10,
    stockQuantity: 2,
    minimumStock: 1,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function category(
  id: string,
  names: CatalogCategory["names"],
  showInMainCatalog = true,
): CatalogCategory {
  return {
    id,
    names,
    showInMainCatalog,
    system: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function page(
  partial: Partial<CustomServicePage> & Pick<CustomServicePage, "id" | "slug">,
): CustomServicePage {
  return {
    name: partial.name || partial.slug,
    status: "published",
    template: "eye-exam",
    showOnHome: false,
    homeSort: 0,
    showHeroButton: true,
    ctaKind: "booking",
    sections: [{ id: "sec_1", type: "heroMedia" }],
    locales: {
      ar: {
        complete: true,
        eyebrow: "",
        title: "عربي",
        description: "",
        bookingButtonText: "احجز",
        features: [],
        benefitsTitle: "",
        benefits: [],
        warningTitle: "",
        warningText: "",
        valuesTitle: "",
        valuesText: "",
        privacyText: "",
        homeTitle: "",
        homeSubtitle: "",
      },
      en: {
        complete: true,
        eyebrow: "",
        title: "English",
        description: "",
        bookingButtonText: "Book",
        features: [],
        benefitsTitle: "",
        benefits: [],
        warningTitle: "",
        warningText: "",
        valuesTitle: "",
        valuesText: "",
        privacyText: "",
        homeTitle: "",
        homeSubtitle: "",
      },
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    revision: 1,
    ...partial,
  };
}

function sampleApp(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 7,
    products: [
      product({ id: "p-live", category: "Frames", categoryIds: ["cat_live"] }),
      product({ id: "p-keep", category: "Sunglasses", name: "Keep me" }),
    ],
    catalogCategories: [
      category("cat_live", { ar: "حية", he: "חי", en: "Live" }),
      category("cat_keep", { ar: "تبقى", he: "נשאר", en: "Keep" }, false),
    ],
    appointments: [],
    customers: [{ id: "c-live", name: "Live customer" } as AppData["customers"][number]],
    staff: [],
    suppliers: [],
    promotions: [{ id: "pr-live" } as AppData["promotions"][number]],
    media: [{ id: "m-live" } as AppData["media"][number]],
    reviews: [],
    contactMessages: [],
    smsLogs: [],
    activityLogs: [],
    holidays: [],
    availability: [],
    eyeExamAvailability: [{ id: "avail-live" } as AppData["eyeExamAvailability"][number]],
    eyeExamAppointments: [
      { id: "b-live", manageTokenHash: "hash-live" } as AppData["eyeExamAppointments"][number],
    ],
    bookingServices: [{ id: "svc-live" } as AppData["bookingServices"][number]],
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
      storeName: "Live store",
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
      seo: { title: "Live SEO", description: "", keywords: "" },
      smtp: {},
      sms: { provider: "console", enabled: false },
      bookingMessages: { provider: "console" } as AppData["settings"]["bookingMessages"],
      appointmentSlotMinutes: 30,
      bookingLeadDays: 1,
      currency: "ILS",
      currencySymbol: "₪",
      servicePages: {
        eyeExam: { title: "Live exam" },
        customPages: [
          page({ id: "csp_live", slug: "today-page", name: "Today page" }),
          page({ id: "csp_shared", slug: "shared", name: "Shared live" }),
        ],
      } as AppData["settings"]["servicePages"],
    },
    updatedAt: "2026-10-10T12:00:00.000Z",
    ...overrides,
  };
}

const live = sampleApp();
const backup = sampleApp({
  version: 6,
  products: [
    product({
      id: "p-old",
      category: "Contact Lenses",
      categoryIds: ["cat_old", "Sunglasses"],
      name: "Yesterday lens",
      stockQuantity: 11,
      status: "draft",
    }),
    product({
      id: "p-live",
      category: "Frames",
      categoryIds: ["cat_old", "cat_missing"],
      name: "Overwritten frame",
      stockQuantity: 99,
    }),
    product({
      id: "p-keep",
      category: "Sunglasses",
      name: "Should not appear unless selected",
    }),
  ],
  catalogCategories: [
    category("cat_old", { ar: "أمس", he: "אתמול", en: "Yesterday" }, false),
    category("cat_keep", { ar: "قديمة", he: "ישן", en: "Old keep" }, true),
  ],
  eyeExamAppointments: [
    { id: "b-old", manageTokenHash: "hash-old" } as AppData["eyeExamAppointments"][number],
  ],
  settings: {
    ...live.settings,
    storeName: "Yesterday store",
    bookingMessages: { provider: "twilio" } as AppData["settings"]["bookingMessages"],
    servicePages: {
      eyeExam: { title: "Yesterday exam" },
      customPages: [
        page({
          id: "csp_shared",
          slug: "shared",
          name: "Shared yesterday",
          locales: {
            ar: {
              ...page({ id: "x", slug: "x" }).locales.ar!,
              title: "صفحة أمس",
            },
            he: {
              complete: true,
              eyebrow: "",
              title: "עמוד אתמול",
              description: "",
              bookingButtonText: "קבעו",
              features: [],
              benefitsTitle: "",
              benefits: [],
              warningTitle: "",
              warningText: "",
              valuesTitle: "",
              valuesText: "",
              privacyText: "",
              homeTitle: "",
              homeSubtitle: "",
            },
            en: {
              ...page({ id: "x", slug: "x" }).locales.en!,
              title: "Yesterday page",
            },
          },
        }),
        page({ id: "csp_old", slug: "kids-exam", name: "Kids exam" }),
      ],
    } as AppData["settings"]["servicePages"],
  },
});

assert.equal(validateRestorableAppData(backup).products.length, 3);
assert.throws(() => validateRestorableAppData({}), /RESTORE_BACKUP_INCOMPLETE|INCOMPATIBLE/);

const pagePlan = applyRestorePlan(live, backup, {
  mode: "customPage",
  backupId: "daily:2026-10-09T00:00:00.000Z",
  pageId: "csp_shared",
});
assert.equal(pagePlan.next.settings.storeName, "Live store");
assert.equal(pagePlan.next.settings.bookingMessages.provider, "console");
assert.equal(pagePlan.next.settings.servicePages?.customPages?.length, 2);
assert.equal(
  pagePlan.next.settings.servicePages?.customPages?.find((item) => item.id === "csp_live")?.name,
  "Today page",
);
assert.equal(
  pagePlan.next.settings.servicePages?.customPages?.find((item) => item.id === "csp_shared")
    ?.locales.ar?.title,
  "صفحة أمس",
);
assert.equal(pagePlan.next.eyeExamAppointments[0].id, "b-live");
assert.ok(
  unchangedOutsidePlan(live, pagePlan.next, {
    mode: "customPage",
    backupId: "x",
    pageId: "csp_shared",
  }),
);

const productPlan = applyRestorePlan(live, backup, {
  mode: "product",
  backupId: "daily:2026-10-09T00:00:00.000Z",
  productId: "p-old",
  membershipPolicy: "preserve-live",
});
assert.ok(productPlan.next.products.some((item) => item.id === "p-keep"));
assert.equal(productPlan.next.products.find((item) => item.id === "p-old")?.stockQuantity, 11);
assert.deepEqual(
  productPlan.next.products.find((item) => item.id === "p-old")?.categoryIds,
  ["Sunglasses"],
);
assert.equal(productPlan.details.droppedMemberships, 1);

const categoryPlan = applyRestorePlan(live, backup, {
  mode: "categoryWithProducts",
  backupId: "daily:2026-10-09T00:00:00.000Z",
  categoryIds: ["cat_old"],
  membershipPolicy: "preserve-live",
});
assert.ok(categoryPlan.next.catalogCategories?.some((item) => item.id === "cat_keep"));
assert.equal(
  categoryPlan.next.catalogCategories?.find((item) => item.id === "cat_keep")?.names.en,
  "Keep",
);
assert.equal(
  categoryPlan.next.catalogCategories?.find((item) => item.id === "cat_old")?.names.ar,
  "أمس",
);
assert.equal(categoryPlan.next.products.find((item) => item.id === "p-keep")?.name, "Keep me");
const overwritten = categoryPlan.next.products.find((item) => item.id === "p-live");
assert.equal(overwritten?.name, "Overwritten frame");
assert.deepEqual(overwritten?.categoryIds, ["cat_old", "cat_live"]);
assert.ok(categoryPlan.details.overwriteProductIds?.includes("p-live"));
assert.equal(categoryPlan.details.lostMemberships?.length || 0, 0);
assert.ok(categoryPlan.next.products.some((item) => item.id === "p-old"));
assert.ok(
  unchangedOutsidePlan(live, categoryPlan.next, {
    mode: "categoryWithProducts",
    backupId: "x",
    categoryIds: ["cat_old"],
    membershipPolicy: "preserve-live",
  }),
);

const exactPlan = applyRestorePlan(live, backup, {
  mode: "categoryWithProducts",
  backupId: "daily:2026-10-09T00:00:00.000Z",
  categoryIds: ["cat_old"],
  membershipPolicy: "backup-exact",
});
assert.deepEqual(
  exactPlan.next.products.find((item) => item.id === "p-live")?.categoryIds,
  ["cat_old"],
);
assert.ok(
  exactPlan.details.lostMemberships?.some(
    (item) => item.productId === "p-live" && item.categoryIds.includes("cat_live"),
  ),
);

const keepOverwrite = applyRestorePlan(live, backup, {
  mode: "categoryWithProducts",
  backupId: "daily:2026-10-09T00:00:00.000Z",
  categoryIds: ["cat_keep"],
  membershipPolicy: "preserve-live",
});
assert.ok(keepOverwrite.details.overwriteCategoryIds?.includes("cat_keep"));
assert.ok(
  keepOverwrite.details.categories?.some((item) => item.id === "cat_keep" && item.overwrite),
);

const fullPlan = applyRestorePlan(live, backup, {
  mode: "full",
  backupId: "daily:2026-10-09T00:00:00.000Z",
});
assert.equal(fullPlan.next.settings.storeName, "Yesterday store");
assert.equal(fullPlan.next.eyeExamAppointments[0].id, "b-old");
assert.equal(fullPlan.next.version, 7);

assert.throws(
  () => parseRestoreRequest({ backupId: "daily:2026-10-09T00:00:00.000Z" }),
  /RESTORE_MODE_REQUIRED/,
);
const compat = parseRestoreRequest({
  backupId: "manual:2026-10-09T00:00:00.000Z",
  categories: ["bookings"],
});
assert.equal(compat.mode, "sections");

async function run() {
  resetRestoreInFlightForTests();
  let wrote = 0;
  let preRestore = 0;
  const snapshot = {
    purpose: "manual" as const,
    createdAt: "2026-10-09T19:00:10.289Z",
    appData: backup,
  };
  const preSnapshot = {
    purpose: "pre-restore" as const,
    createdAt: "2026-10-10T08:00:00.000Z",
    appData: live,
  };
  const goodDeps = {
    loadSnapshot: async (id: string) =>
      id.startsWith("pre-restore:") ? preSnapshot : snapshot,
    loadLatestPreRestore: async () => preSnapshot,
    readLive: async () => ({
      payload: structuredClone(live),
      updatedAt: live.updatedAt,
      payloadBytes: 1,
    }),
    createPreRestore: async () => {
      preRestore += 1;
      return { ok: true, complete: true } as never;
    },
    writeLive: async () => {
      wrote += 1;
    },
    vercelEnv: "production",
  };

  assert.equal(isLiveRestoreAllowed("preview"), false);

  const previewPage = await previewRestoreRequest(
    {
      backupId: "manual:2026-10-09T19:00:10.289Z",
      mode: "customPage",
      pageId: "csp_shared",
    },
    { ...goodDeps, vercelEnv: "preview" },
  );
  assert.equal(previewPage.mode, "customPage");
  assert.equal(previewPage.details.pages?.[0]?.id, "csp_shared");
  assert.equal(wrote, 0);

  const previewCategory = await previewRestoreRequest(
    {
      backupId: "manual:2026-10-09T19:00:10.289Z",
      mode: "categoryWithProducts",
      categoryIds: ["cat_old"],
    },
    goodDeps,
  );
  assert.ok(previewCategory.details.overwriteProductIds?.includes("p-live"));

  const sections = await previewRestore(
    "manual:2026-10-09T19:00:10.289Z",
    ["bookings"],
    goodDeps,
  );
  assert.equal(sections.mode, "sections");
  assert.equal(sections.sections[0].backupCount, 1);

  await assert.rejects(
    () =>
      executeRestoreRequest(
        {
          backupId: "manual:2026-10-09T19:00:10.289Z",
          mode: "full",
          confirm: true,
        },
        {
          ...goodDeps,
          restoreMedia: async () => ({
            complete: false,
            referenced: 1,
            alreadyPresent: 0,
            restored: 0,
            missing: 1,
            failed: 0,
          }),
        },
      ),
    /RESTORE_MEDIA_FAILED/,
  );
  assert.equal(wrote, 0);
  assert.equal(preRestore, 1);

  await assert.rejects(
    () =>
      executeRestoreRequest(
        {
          backupId: "manual:2026-10-09T19:00:10.289Z",
          mode: "full",
          confirm: true,
        },
        {
          ...goodDeps,
          restoreMedia: async () => ({
            complete: true,
            referenced: 1,
            alreadyPresent: 0,
            restored: 0,
            missing: 1,
            failed: 0,
          }),
        },
      ),
    /RESTORE_MEDIA_FAILED/,
  );
  assert.equal(wrote, 0);
  assert.equal(preRestore, 2);

  assert.deepEqual(collectReferencedMediaPaths({ images: ["products/gone.jpg"] }), [
    "products/gone.jpg",
  ]);

  const media = await restoreMissingMedia(
    {
      products: [
        product({
          id: "p1",
          category: "Frames",
          images: [
            "https://example.supabase.co/storage/v1/object/public/lumina-media/products/a.jpg",
            "https://cdn.example/external.png",
          ],
        }),
      ],
    },
    {
      liveExists: async (path) => path.endsWith("present.jpg"),
      downloadProtected: async (path) =>
        path.endsWith("a.jpg")
          ? { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }
          : null,
      uploadLive: async () => undefined,
      verifyLive: async (_path, expected) => expected === 3,
    },
  );
  assert.equal(media.complete, true);
  assert.equal(media.restored, 1);
  assert.equal(media.missing, 0);

  const missing = await restoreMissingMedia(
    {
      products: [
        product({
          id: "p1",
          category: "Frames",
          images: [
            "https://example.supabase.co/storage/v1/object/public/lumina-media/products/gone.jpg",
          ],
        }),
      ],
    },
    {
      liveExists: async () => false,
      downloadProtected: async () => null,
      uploadLive: async () => undefined,
      verifyLive: async () => false,
    },
  );
  assert.equal(missing.complete, false);
  assert.equal(missing.missing, 1);

  const okPage = await executeRestoreRequest(
    {
      backupId: "manual:2026-10-09T19:00:10.289Z",
      mode: "customPage",
      pageId: "csp_old",
      confirm: true,
    },
    {
      ...goodDeps,
      restoreMedia: async () => ({
        complete: true,
        referenced: 0,
        alreadyPresent: 0,
        restored: 0,
        missing: 0,
        failed: 0,
      }),
    },
  );
  assert.equal(okPage.ok, true);
  assert.equal(okPage.mode, "customPage");
  assert.equal(wrote, 1);

  const okSections = await executeRestore(
    "manual:2026-10-09T19:00:10.289Z",
    ["lenses"],
    true,
    {
      ...goodDeps,
      restoreMedia: async () => ({
        complete: true,
        referenced: 0,
        alreadyPresent: 0,
        restored: 0,
        missing: 0,
        failed: 0,
      }),
    },
  );
  assert.equal(okSections.mode, "sections");
  assert.equal(wrote, 2);

  const rollback = await executeRestoreRequest(
    { mode: "rollback", confirm: true },
    {
      ...goodDeps,
      restoreMedia: async () => ({
        complete: true,
        referenced: 0,
        alreadyPresent: 0,
        restored: 0,
        missing: 0,
        failed: 0,
      }),
    },
  );
  assert.equal(rollback.mode, "rollback");
  assert.equal(rollback.backup.kind, "pre-restore");
  assert.equal(wrote, 3);

  console.log(
    JSON.stringify(
      {
        isolated: "pass",
        pagePreservesOthers: true,
        productKeepsUnrelated: true,
        categoryKeepsUnrelated: true,
        multiCategorySanitized: true,
        fullRestore: true,
        mediaFailureBlocksWrite: true,
        rollback: true,
        existingSections: true,
      },
      null,
      2,
    ),
  );
}

void run();
