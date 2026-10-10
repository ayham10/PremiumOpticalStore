import assert from "node:assert/strict";
import { RESTORABLE_SECTIONS } from "../lib/backup";
import {
  RESTORE_CATEGORIES,
  RESTORE_CATEGORY_FIELDS,
  applyRestoreCategories,
  parseRestoreCategories,
  unselectedFieldsMatch,
} from "../lib/restore-apply";
import type { AppData, CustomServicePage, Product } from "../lib/types";

/**
 * Isolated coverage for the backup/restore audit.
 * Documents current production behavior. Does not write Supabase or restore live data.
 */

assert.deepEqual(
  [...RESTORE_CATEGORIES],
  ["bookings", "products", "lenses", "settings", "promotions"],
);
assert.throws(() => parseRestoreCategories(["customPages"]), /RESTORE_CATEGORY_INVALID/);
assert.throws(() => parseRestoreCategories(["page"]), /RESTORE_CATEGORY_INVALID/);
assert.ok(
  !RESTORE_CATEGORIES.includes("media" as (typeof RESTORE_CATEGORIES)[number]),
);
assert.deepEqual([...RESTORE_CATEGORY_FIELDS.bookings], [
  "eyeExamAppointments",
  "appointments",
]);
assert.deepEqual([...RESTORE_CATEGORY_FIELDS.products], [
  "products",
  "catalogCategories",
]);
assert.deepEqual([...RESTORE_CATEGORY_FIELDS.lenses], ["lensInventory"]);
assert.deepEqual([...RESTORE_CATEGORY_FIELDS.settings], ["settings"]);
assert.ok(RESTORABLE_SECTIONS.includes("catalogCategories"));
assert.ok(RESTORABLE_SECTIONS.includes("settings"));
assert.ok(RESTORABLE_SECTIONS.includes("products"));
assert.ok(RESTORABLE_SECTIONS.includes("media"));

function sampleProduct(
  partial: Partial<Product> & Pick<Product, "id" | "category">,
): Product {
  return {
    slug: partial.id,
    name: partial.name || partial.id,
    brand: "OYON",
    sku: partial.id,
    description: "",
    images: partial.images || ["https://example.supabase.co/storage/v1/object/public/lumina-media/products/live.jpg"],
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

function yesterdayPage(): CustomServicePage {
  return {
    id: "csp_yesterday",
    slug: "kids-exam",
    name: "Kids exam",
    status: "published",
    template: "eye-exam",
    showOnHome: true,
    homeSort: 1,
    showHeroButton: true,
    ctaKind: "booking",
    sections: [
      {
        id: "sec_hero",
        type: "heroMedia",
        adminLabel: "Hero AR only",
        article: {
          align: "center",
          position: "before",
          locales: {
            ar: { heading: "عنوان أمس", body: "نص أمس" },
            he: { heading: "כותרת אתמול", body: "טקסט אתמול" },
            en: { heading: "Yesterday heading", body: "Yesterday body" },
          },
        },
      },
      { id: "sec_products", type: "products" },
    ],
    heroMedia: {
      kind: "image",
      url: "https://example.supabase.co/storage/v1/object/public/lumina-media/hero/source.jpg",
      desktopUrl:
        "https://example.supabase.co/storage/v1/object/public/lumina-media/hero/hero-desktop.webp",
      mobileUrl:
        "https://example.supabase.co/storage/v1/object/public/lumina-media/hero/hero-mobile.webp",
      desktopFocal: { x: 0.4, y: 0.3, zoom: 1.2 },
      mobileFocal: { x: 0.5, y: 0.6, zoom: 1.4 },
      fit: "cover",
    },
    productIds: ["p-old", "p-shared"],
    locales: {
      ar: {
        complete: true,
        eyebrow: "أمس",
        title: "فحص الأطفال",
        description: "وصف أمس",
        bookingButtonText: "احجز",
        features: [{ title: "ميزة", description: "وصف", icon: "Eye" }],
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
      he: {
        complete: true,
        eyebrow: "אתמול",
        title: "בדיקת ילדים",
        description: "תיאור אתמול",
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
        complete: true,
        eyebrow: "Yesterday",
        title: "Kids exam",
        description: "Yesterday description",
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
    createdAt: "2026-10-09T10:00:00.000Z",
    updatedAt: "2026-10-09T10:00:00.000Z",
    revision: 4,
  };
}

function sampleApp(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    products: [sampleProduct({ id: "p-live", category: "Frames", categoryIds: ["cat_live"] })],
    catalogCategories: [
      {
        id: "cat_live",
        names: { ar: "حية", he: "חי", en: "Live" },
        showInMainCatalog: true,
        system: false,
        createdAt: "2026-10-10T00:00:00.000Z",
        updatedAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    appointments: [],
    customers: [],
    staff: [],
    suppliers: [],
    promotions: [],
    media: [
      {
        id: "m-live",
        url: "https://example.supabase.co/storage/v1/object/public/lumina-media/gallery/live.jpg",
        type: "image",
        folder: "gallery",
        createdAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    reviews: [],
    contactMessages: [],
    smsLogs: [],
    activityLogs: [],
    holidays: [],
    availability: [],
    eyeExamAvailability: [{ id: "avail-live" } as AppData["eyeExamAvailability"][number]],
    eyeExamAppointments: [
      {
        id: "b-live",
        manageTokenHash: "hash-live",
      } as AppData["eyeExamAppointments"][number],
    ],
    bookingServices: [{ id: "svc-live" } as AppData["bookingServices"][number]],
    lensInventory: [
      {
        type: "minus",
        sph: "-1.00",
        cyl: "0.00",
        currentStock: 3,
        desiredStock: 5,
        updatedAt: "2026-10-10T00:00:00.000Z",
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
      bookingMessages: {} as AppData["settings"]["bookingMessages"],
      appointmentSlotMinutes: 30,
      bookingLeadDays: 1,
      currency: "ILS",
      currencySymbol: "₪",
      servicePages: {
        eyeExam: { title: "Live exam" },
        customPages: [
          yesterdayPage(),
          {
            ...yesterdayPage(),
            id: "csp_today",
            slug: "new-today",
            name: "Created today",
            locales: {
              en: {
                ...yesterdayPage().locales.en!,
                title: "Created today",
              },
            },
          },
        ],
      } as AppData["settings"]["servicePages"],
    },
    updatedAt: "2026-10-10T12:00:00.000Z",
    ...overrides,
  };
}

const live = sampleApp();
const backup = sampleApp({
  products: [
    sampleProduct({
      id: "p-old",
      category: "Contact Lenses",
      categoryIds: ["cat_old", "Sunglasses"],
      stockQuantity: 11,
      status: "draft",
    }),
    sampleProduct({
      id: "p-shared",
      category: "Frames",
      categoryIds: ["cat_old"],
    }),
  ],
  catalogCategories: [
    {
      id: "cat_old",
      names: { ar: "أمس", he: "אתמול", en: "Yesterday" },
      showInMainCatalog: false,
      system: false,
      createdAt: "2026-10-09T00:00:00.000Z",
      updatedAt: "2026-10-09T00:00:00.000Z",
    },
  ],
  media: [
    {
      id: "m-old",
      url: "https://example.supabase.co/storage/v1/object/public/lumina-media/gallery/old.jpg",
      type: "image",
      folder: "gallery",
      createdAt: "2026-10-09T00:00:00.000Z",
    },
  ],
  eyeExamAvailability: [{ id: "avail-old" } as AppData["eyeExamAvailability"][number]],
  eyeExamAppointments: [
    {
      id: "b-old",
      manageTokenHash: "hash-old",
    } as AppData["eyeExamAppointments"][number],
  ],
  lensInventory: [
    {
      type: "plus",
      sph: "+2.00",
      cyl: "0.00",
      currentStock: 8,
      desiredStock: 8,
      updatedAt: "2026-10-09T00:00:00.000Z",
    },
  ],
  settings: {
    ...live.settings,
    storeName: "Yesterday store",
    seo: { title: "Yesterday SEO", description: "old", keywords: "" },
    servicePages: {
      eyeExam: { title: "Yesterday exam" },
      locales: {
        ar: { eyeExam: { title: "فحص أمس" } },
        he: { eyeExam: { title: "בדיקה אתמול" } },
        en: { eyeExam: { title: "Yesterday exam" } },
      },
      customPages: [yesterdayPage()],
    } as AppData["settings"]["servicePages"],
  },
});

const restoredSettings = applyRestoreCategories(live, backup, ["settings"]);
assert.equal(restoredSettings.settings.storeName, "Yesterday store");
assert.equal(restoredSettings.settings.seo.title, "Yesterday SEO");
assert.equal(restoredSettings.settings.servicePages?.customPages?.length, 1);
assert.equal(restoredSettings.settings.servicePages?.customPages?.[0]?.id, "csp_yesterday");
assert.equal(
  restoredSettings.settings.servicePages?.customPages?.some((page) => page.id === "csp_today"),
  false,
  "settings restore replaces every custom page; newer pages are not preserved",
);
const page = restoredSettings.settings.servicePages?.customPages?.[0];
assert.equal(page?.locales.ar?.title, "فحص الأطفال");
assert.equal(page?.locales.he?.title, "בדיקת ילדים");
assert.equal(page?.locales.en?.title, "Kids exam");
assert.equal(page?.sections[0]?.adminLabel, "Hero AR only");
assert.equal(page?.sections[0]?.article?.align, "center");
assert.equal(page?.sections[0]?.article?.position, "before");
assert.equal(page?.sections[0]?.article?.locales?.ar?.heading, "عنوان أمس");
assert.equal(page?.heroMedia?.desktopFocal?.zoom, 1.2);
assert.equal(page?.heroMedia?.mobileFocal?.y, 0.6);
assert.deepEqual(page?.productIds, ["p-old", "p-shared"]);
assert.equal(page?.status, "published");
assert.equal(restoredSettings.eyeExamAppointments[0].id, "b-live");
assert.equal(restoredSettings.products[0].id, "p-live");
assert.equal(restoredSettings.catalogCategories?.[0]?.id, "cat_live");
assert.equal(restoredSettings.media[0].id, "m-live");
assert.ok(unselectedFieldsMatch(live, restoredSettings, ["settings"]));

const restoredProducts = applyRestoreCategories(live, backup, ["products"]);
assert.equal(restoredProducts.products.length, 2);
assert.equal(restoredProducts.products[0].id, "p-old");
assert.deepEqual(restoredProducts.products[0].categoryIds, ["cat_old", "Sunglasses"]);
assert.equal(restoredProducts.catalogCategories?.[0]?.id, "cat_old");
assert.equal(restoredProducts.catalogCategories?.[0]?.showInMainCatalog, false);
assert.equal(restoredProducts.catalogCategories?.[0]?.names.ar, "أمس");
assert.equal(restoredProducts.settings.servicePages?.customPages?.length, 2);
assert.equal(restoredProducts.eyeExamAppointments[0].id, "b-live");
assert.ok(unselectedFieldsMatch(live, restoredProducts, ["products"]));

const oldSnapshotWithoutCategories = structuredClone(backup);
delete oldSnapshotWithoutCategories.catalogCategories;
const restoredLegacyProducts = applyRestoreCategories(
  live,
  oldSnapshotWithoutCategories,
  ["products"],
);
assert.deepEqual(restoredLegacyProducts.catalogCategories, []);

const restoredBookings = applyRestoreCategories(live, backup, ["bookings"]);
assert.equal(restoredBookings.eyeExamAppointments[0].id, "b-old");
assert.equal(restoredBookings.eyeExamAppointments[0].manageTokenHash, "hash-old");
assert.equal(restoredBookings.eyeExamAvailability[0].id, "avail-live");
assert.equal(restoredBookings.bookingServices[0].id, "svc-live");
assert.equal(restoredBookings.settings.servicePages?.customPages?.length, 2);
assert.equal(restoredBookings.products[0].id, "p-live");
assert.equal(restoredBookings.media[0].id, "m-live");
assert.ok(unselectedFieldsMatch(live, restoredBookings, ["bookings"]));

const restoredLenses = applyRestoreCategories(live, backup, ["lenses"]);
assert.equal(restoredLenses.lensInventory[0].sph, "+2.00");
assert.equal(restoredLenses.settings.servicePages?.customPages?.length, 2);
assert.ok(unselectedFieldsMatch(live, restoredLenses, ["lenses"]));

console.log(
  JSON.stringify(
    {
      isolated: "pass",
      singlePageRestore: false,
      settingsReplacesAllCustomPages: true,
      productsRestoreIncludesCatalogCategories: true,
      mediaLibraryNotRestored: true,
      mediaFilesNotCopiedByApplyRestore: true,
      bookingsLeaveAvailabilityAndPages: true,
    },
    null,
    2,
  ),
);
