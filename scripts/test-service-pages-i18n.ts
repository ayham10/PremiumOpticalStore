import assert from "node:assert/strict";
import {
  DEFAULT_SERVICE_PAGES,
  hydrateServicePagesForEditor,
  localePatchPayload,
  migrateServicePagesDocument,
  persistServicePages,
  pickServiceText,
  publicServicePages,
  resolveServicePagesForLocale,
} from "../lib/service-pages";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";

const legacyArabic = {
  eyeExam: {
    title: "فحص نظر شامل",
    eyebrow: "رعاية احترافية",
    description: "وصف عربي محفوظ",
    bookingButtonText: "احجز فحص نظر",
  },
  contactLenses: {
    title: "العدسات اللاصقة",
    warningText: "تحذير عربي",
  },
  homepage: {
    hero: {
      title: "عِش الحياة بوضوح",
      serviceLabels: ["إطارات طبية", "نظارات شمسية", "فحص نظر احترافي"],
      bookingButtonText: "احجز موعدًا",
      shopButtonText: "تسوق الآن",
    },
  },
};

const migrated = migrateServicePagesDocument(legacyArabic);
assert.equal(migrated.locales?.ar?.eyeExam.title, "فحص نظر شامل");
assert.equal(migrated.locales?.he, undefined);
assert.equal(migrated.locales?.en, undefined);
assert.equal(migrated.homepage?.hero.title, "عِش الحياة بوضوح");

const existingHe = migrateServicePagesDocument({
  ...legacyArabic,
  locales: {
    he: { eyeExam: { title: "בדיקת עיניים שמורה" } },
  },
});
assert.equal(existingHe.locales?.he?.eyeExam.title, "בדיקת עיניים שמורה");
assert.equal(existingHe.locales?.ar?.eyeExam.title, "فحص نظر شامل");

const existingArKept = migrateServicePagesDocument({
  eyeExam: { title: "جذر قديم" },
  contactLenses: {},
  locales: {
    ar: { eyeExam: { title: "عربي محفوظ مسبقاً" }, contactLenses: {} },
  },
});
assert.equal(existingArKept.locales?.ar?.eyeExam.title, "عربي محفوظ مسبقاً");

const resolvedHeMissing = resolveServicePagesForLocale(legacyArabic, "he");
assert.equal(resolvedHeMissing, undefined);
assert.equal(
  pickServiceText(resolvedHeMissing?.eyeExam.title, "בדיקת עיניים מקיפה"),
  "בדיקת עיניים מקיפה",
);

const resolvedAr = resolveServicePagesForLocale(legacyArabic, "ar");
assert.equal(resolvedAr?.eyeExam.title, "فحص نظر شامل");
assert.equal(resolvedAr?.homepage?.hero.title, "عِش الحياة بوضوح");

const publicDoc = publicServicePages(legacyArabic);
assert.ok(publicDoc?.locales?.ar);
assert.equal(publicDoc?.locales?.he, undefined);
assert.equal(publicDoc?.locales?.en, undefined);
assert.equal(
  resolveServicePagesForLocale(publicDoc, "he")?.eyeExam.title || "",
  "",
);
assert.notEqual(publicDoc?.eyeExam.title, undefined);

const heDefaults = defaultServicePagesForLocale("he");
assert.match(heDefaults.eyeExam.title, /[\u0590-\u05FF]/);
assert.doesNotMatch(heDefaults.eyeExam.title, /[\u0600-\u06FF]/);
assert.equal(heDefaults.footer?.address, "דיר חנא");

const enDefaults = defaultServicePagesForLocale("en");
assert.equal(enDefaults.homepage?.hero.title, "SEE LIFE IN FOCUS");
assert.equal(enDefaults.footer?.hoursLabel, "Hours");
assert.equal(enDefaults.sunglasses?.title, "Sunglasses");
assert.equal(enDefaults.frames?.title, "Premium Frames");
assert.equal(heDefaults.sunglasses?.title, "משקפי שמש");
assert.equal(heDefaults.frames?.title, "מסגרות פרימיום");
assert.equal(DEFAULT_SERVICE_PAGES.sunglasses?.title, "نظارات شمسية");
assert.equal(DEFAULT_SERVICE_PAGES.frames?.title, "إطارات فاخرة");

const hydratedHe = hydrateServicePagesForEditor(
  legacyArabic,
  "he",
  heDefaults,
);
assert.equal(hydratedHe.eyeExam.title, heDefaults.eyeExam.title);
assert.equal(hydratedHe.homepage?.hero.title, heDefaults.homepage?.hero.title);
assert.equal(
  hydratedHe.eyeExam.features[0]?.icon,
  DEFAULT_SERVICE_PAGES.eyeExam.features[0]?.icon,
);

hydratedHe.eyeExam.title = "כותרת עברית שמורה";
hydratedHe.footer = {
  ...heDefaults.footer!,
  address: "דיר חנא",
  tagline: "תיאור עברי",
};
const afterHe = persistServicePages(
  legacyArabic,
  localePatchPayload("he", hydratedHe, { includeHomepage: true }),
);
assert.equal(afterHe.locales?.he?.eyeExam.title, "כותרת עברית שמורה");
assert.equal(afterHe.locales?.ar?.eyeExam.title, "فحص نظر شامل");
assert.equal(afterHe.eyeExam.title, "فحص نظر شامل");
assert.equal(afterHe.locales?.en, undefined);
assert.equal(afterHe.locales?.he?.footer?.tagline, "תיאור עברי");

const englishSave = persistServicePages(
  afterHe,
  localePatchPayload(
    "en",
    {
      ...enDefaults,
      homepage: {
        hero: {
          ...enDefaults.homepage!.hero,
          title: "See Life Clearly",
          subtitle: "Frames • Sunglasses • Eye Exam",
        },
      },
    },
    { includeHomepage: true },
  ),
);
assert.equal(englishSave.locales?.en?.homepage?.hero.title, "See Life Clearly");
assert.equal(englishSave.locales?.en?.homepage?.hero.subtitle, "Frames • Sunglasses • Eye Exam");
assert.equal(englishSave.locales?.he?.eyeExam.title, "כותרת עברית שמורה");
assert.equal(englishSave.locales?.ar?.eyeExam.title, "فحص نظر شامل");
assert.equal(englishSave.homepage?.hero.title, "عِش الحياة بوضوح");

const arabicSave = persistServicePages(englishSave, {
  locales: {
    ar: {
      ...DEFAULT_SERVICE_PAGES,
      eyeExam: { ...DEFAULT_SERVICE_PAGES.eyeExam, title: "عنوان عربي محدّث" },
    },
  },
});
assert.equal(arabicSave.locales?.ar?.eyeExam.title, "عنوان عربي محدّث");
assert.equal(arabicSave.eyeExam.title, "عنوان عربي محدّث");
assert.equal(arabicSave.locales?.he?.eyeExam.title, "כותרת עברית שמורה");
assert.equal(arabicSave.locales?.en?.homepage?.hero.title, "See Life Clearly");

assert.equal(
  resolveServicePagesForLocale(arabicSave, "he")?.eyeExam.title,
  "כותרת עברית שמורה",
);
assert.equal(
  resolveServicePagesForLocale(arabicSave, "en")?.homepage?.hero.title,
  "See Life Clearly",
);
assert.equal(
  pickServiceText(
    resolveServicePagesForLocale(arabicSave, "he")?.contactLenses.title,
    heDefaults.contactLenses.title,
  ),
  heDefaults.contactLenses.title,
);

const legacyRootPatch = persistServicePages(legacyArabic, {
  eyeExam: { title: "تعديل جذري" },
});
assert.equal(legacyRootPatch.locales?.ar?.eyeExam.title, "تعديل جذري");
assert.equal(legacyRootPatch.locales?.he, undefined);

const heWithoutHomepage = persistServicePages(
  legacyArabic,
  localePatchPayload("he", heDefaults, { includeHomepage: false }),
);
assert.equal(heWithoutHomepage.locales?.he?.homepage, undefined);
assert.equal(
  resolveServicePagesForLocale(heWithoutHomepage, "he")?.homepage,
  undefined,
);
assert.equal(heWithoutHomepage.homepage?.hero.title, "عِش الحياة بوضوح");

const withCustomPage = persistServicePages(
  {
    ...legacyArabic,
    customPages: [
      {
        id: "csp_keep",
        slug: "kids-exam",
        name: "Kids",
        status: "draft",
        template: "eye-exam",
        showOnHome: false,
        homeSort: 0,
        sections: [{ id: "sec_1", type: "heroMedia" }],
        locales: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
    ],
  },
  localePatchPayload("he", heDefaults, { includeHomepage: true }),
);
assert.equal(withCustomPage.customPages?.[0]?.slug, "kids-exam");
assert.equal(withCustomPage.customPages?.[0]?.status, "draft");
assert.equal(withCustomPage.locales?.ar?.eyeExam.title, "فحص نظر شامل");

const mediaSave = persistServicePages(
  arabicSave,
  localePatchPayload("ar", {
    ...DEFAULT_SERVICE_PAGES,
    eyeExam: {
      ...DEFAULT_SERVICE_PAGES.eyeExam,
      title: "عنوان عربي محدّث",
      heroMedia: {
        kind: "image",
        url: "https://cdn.example/eye-exam.webp",
      },
    },
    catalog: {
      title: "المتجر المحدث",
      lead: "مجموعة جديدة",
      heroMedia: { kind: "image", url: "https://cdn.example/shop.jpg" },
    },
    sunglasses: {
      title: "شمسية محدثة",
      lead: "وصف الشمسية",
      heroMedia: { kind: "video", url: "https://cdn.example/sun.mp4" },
    },
    frames: {
      title: "إطارات محدثة",
      lead: "وصف الإطارات",
      heroMedia: { kind: "image", url: "https://cdn.example/frames.jpg" },
    },
    adminSectionNames: {
      "eyeExam-benefits": "مميزات الفحص — تنظيم",
    },
  }),
);
assert.equal(
  mediaSave.locales?.ar?.eyeExam.heroMedia?.url,
  "https://cdn.example/eye-exam.webp",
);
assert.equal(mediaSave.locales?.ar?.catalog?.title, "المتجر المحدث");
assert.equal(mediaSave.locales?.ar?.sunglasses?.title, "شمسية محدثة");
assert.equal(mediaSave.locales?.ar?.sunglasses?.heroMedia?.url, "https://cdn.example/sun.mp4");
assert.equal(mediaSave.locales?.ar?.frames?.title, "إطارات محدثة");
assert.equal(mediaSave.locales?.ar?.frames?.heroMedia?.url, "https://cdn.example/frames.jpg");
assert.equal(
  mediaSave.locales?.ar?.adminSectionNames?.["eyeExam-benefits"],
  "مميزات الفحص — تنظيم",
);
assert.equal(
  mediaSave.locales?.he?.eyeExam.title,
  "כותרת עברית שמורה",
);

const publicMedia = publicServicePages(mediaSave);
assert.equal(
  publicMedia?.locales?.ar?.eyeExam.heroMedia?.url,
  "https://cdn.example/eye-exam.webp",
);
assert.equal(publicMedia?.locales?.ar?.catalog?.title, "المتجر المحدث");
assert.equal(publicMedia?.locales?.ar?.sunglasses?.title, "شمسية محدثة");
assert.equal(publicMedia?.locales?.ar?.frames?.title, "إطارات محدثة");
assert.equal(publicMedia?.locales?.ar?.adminSectionNames, undefined);
assert.equal(
  resolveServicePagesForLocale(publicMedia, "he")?.eyeExam.heroMedia?.url,
  "https://cdn.example/eye-exam.webp",
);
assert.notEqual(
  resolveServicePagesForLocale(publicMedia, "ar")?.eyeExam.title,
  publicMedia?.locales?.ar?.adminSectionNames?.["eyeExam-benefits"],
);

const restoredMedia = persistServicePages(
  mediaSave,
  localePatchPayload("ar", {
    ...DEFAULT_SERVICE_PAGES,
    eyeExam: { ...DEFAULT_SERVICE_PAGES.eyeExam, title: "عنوان عربي محدّث" },
    catalog: { title: "المتجر المحدث", lead: "مجموعة جديدة" },
    sunglasses: { title: "شمسية محدثة", lead: "وصف الشمسية" },
    frames: { title: "إطارات محدثة", lead: "وصف الإطارات" },
  }),
);
assert.equal(restoredMedia.locales?.ar?.eyeExam.heroMedia, undefined);
assert.equal(restoredMedia.locales?.ar?.catalog?.heroMedia, undefined);
assert.equal(restoredMedia.locales?.ar?.sunglasses?.heroMedia, undefined);
assert.equal(restoredMedia.locales?.ar?.frames?.heroMedia, undefined);

const sunglassesOnly = persistServicePages(
  mediaSave,
  localePatchPayload("ar", {
    ...DEFAULT_SERVICE_PAGES,
    eyeExam: { ...DEFAULT_SERVICE_PAGES.eyeExam, title: "عنوان عربي محدّث" },
    catalog: {
      title: "المتجر المحدث",
      lead: "مجموعة جديدة",
      heroMedia: { kind: "image", url: "https://cdn.example/shop.jpg" },
    },
    sunglasses: {
      title: "شمسية مستقلة",
      lead: "لا تلمس الإطارات",
      heroMedia: { kind: "image", url: "https://cdn.example/sun-only.jpg" },
    },
    frames: {
      title: "إطارات محدثة",
      lead: "وصف الإطارات",
      heroMedia: { kind: "image", url: "https://cdn.example/frames.jpg" },
    },
  }),
);
assert.equal(sunglassesOnly.locales?.ar?.sunglasses?.title, "شمسية مستقلة");
assert.equal(
  sunglassesOnly.locales?.ar?.sunglasses?.heroMedia?.url,
  "https://cdn.example/sun-only.jpg",
);
assert.equal(sunglassesOnly.locales?.ar?.frames?.title, "إطارات محدثة");
assert.equal(
  sunglassesOnly.locales?.ar?.frames?.heroMedia?.url,
  "https://cdn.example/frames.jpg",
);
assert.equal(sunglassesOnly.locales?.ar?.catalog?.title, "المتجر المحدث");
assert.equal(
  sunglassesOnly.locales?.ar?.catalog?.heroMedia?.url,
  "https://cdn.example/shop.jpg",
);

const framesOnly = persistServicePages(
  sunglassesOnly,
  localePatchPayload("he", {
    ...heDefaults,
    sunglasses: {
      title: "משקפי שמש עברית",
      lead: "תיאור שמש",
      heroMedia: { kind: "video", url: "https://cdn.example/sun-he.mp4" },
    },
    frames: {
      title: "מסגרות עברית",
      lead: "תיאור מסגרות",
      heroMedia: { kind: "image", url: "https://cdn.example/frames-he.jpg" },
    },
  }),
);
assert.equal(framesOnly.locales?.he?.sunglasses?.title, "משקפי שמש עברית");
assert.equal(framesOnly.locales?.he?.frames?.title, "מסגרות עברית");
assert.equal(framesOnly.locales?.ar?.sunglasses?.title, "شمسية مستقلة");
assert.equal(framesOnly.locales?.ar?.frames?.title, "إطارات محدثة");
assert.equal(framesOnly.locales?.ar?.catalog?.title, "المتجر المحدث");
assert.notEqual(
  framesOnly.locales?.he?.sunglasses?.heroMedia?.url,
  framesOnly.locales?.he?.frames?.heroMedia?.url,
);

console.log("service-pages i18n tests passed");
