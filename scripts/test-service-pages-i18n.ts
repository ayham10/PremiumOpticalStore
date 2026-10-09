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

console.log("service-pages i18n tests passed");
