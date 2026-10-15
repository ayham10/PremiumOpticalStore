import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandServicePagesTranslations } from "../lib/content-i18n";
import {
  emptyCustomPageCopy,
  persistCustomPages,
  resolvePublishedCustomPage,
} from "../lib/custom-service-pages";
import { PUBLIC_JSON_CACHE_CONTROL } from "../lib/http-cache";
import {
  applyProductTranslations,
  resolveProductCopy,
} from "../lib/product-i18n";
import {
  DEFAULT_SERVICE_PAGES,
  localePatchPayload,
  persistServicePages,
  resolveServicePagesForLocale,
} from "../lib/service-pages";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";
import { shouldTranslateField } from "../lib/translate-text";
import type { CustomPageCopy, ServicePagesSettings } from "../lib/types";

const fakeTranslate = async (text: string, _from: string, to: string) =>
  `[${to}]${text}`;

async function main() {
assert.equal(
  shouldTranslateField({
    source: "عنوان",
    previous: "قديم",
    target: "",
    targetLocale: "he",
    fillMissing: false,
  }),
  true,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان",
    previous: "عنوان",
    target: "",
    targetLocale: "he",
    fillMissing: false,
  }),
  false,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان",
    previous: "عنوان",
    target: "",
    targetLocale: "he",
    fillMissing: true,
  }),
  true,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان جديد",
    previous: "عنوان",
    target: "כותרת ידנית",
    targetLocale: "he",
    fillMissing: false,
  }),
  false,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان",
    previous: "عنوان",
    target: "عنوان",
    targetLocale: "he",
    fillMissing: false,
  }),
  true,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان جديد",
    previous: "عنوان",
    target: "[he]عنوان",
    targetLocale: "he",
    fillMissing: false,
    targetOrigin: "machine",
  }),
  true,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان جديد",
    previous: "عنوان",
    target: "כותרת ידנית",
    targetLocale: "he",
    fillMissing: false,
    targetOrigin: "manual",
  }),
  false,
);

const created = await applyProductTranslations({
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي", color: "أسود" },
  translate: fakeTranslate,
});
assert.equal(created.locales.he?.name, "[he]إطار ذهبي");
assert.equal(created.locales.en?.name, "[en]إطار ذهبي");
assert.equal(resolveProductCopy(created, "he").name, "[he]إطار ذهبي");
assert.equal(resolveProductCopy(created, "en").description, "[en]وصف عربي");
assert.deepEqual(created.failures, []);

const failingTranslate = async (text: string, _from: string, to: string) => {
  if (to === "en") throw new Error("timeout");
  return `[${to}]${text}`;
};
const partialProduct = await applyProductTranslations({
  sourceLocale: "ar",
  fields: { name: "إطار ذهبي", description: "وصف عربي" },
  translate: failingTranslate,
});
assert.equal(partialProduct.locales.he?.name, "[he]إطار ذهبي");
assert.equal(partialProduct.locales.en?.name || "", "");
assert.ok(partialProduct.failures.some((item) => item.locale === "en"));

const arDefaults = defaultServicePagesForLocale("ar");
const storedAr = persistServicePages(undefined, {
  ...localePatchPayload("ar", {
    ...arDefaults,
    eyeExam: { ...arDefaults.eyeExam, title: "عنوان قديم" },
  }),
});
assert.equal(storedAr.locales?.he, undefined);

const expandedSite = await expandServicePagesTranslations({
  stored: storedAr,
  patch: localePatchPayload("ar", {
    ...arDefaults,
    eyeExam: { ...arDefaults.eyeExam, title: "عنوان عربي محدّث" },
  }),
  translate: fakeTranslate,
});
const savedSite = persistServicePages(storedAr, expandedSite.patch);
assert.equal(savedSite.locales?.ar?.eyeExam.title, "عنوان عربي محدّث");
assert.equal(savedSite.locales?.he?.eyeExam.title, "[he]عنوان عربي محدّث");
assert.equal(savedSite.locales?.en?.eyeExam.title, "[en]عنوان عربي محدّث");
assert.equal(
  resolveServicePagesForLocale(savedSite, "he")?.eyeExam.title,
  "[he]عنوان عربي محدّث",
);
assert.deepEqual(expandedSite.failures, []);

const heManualExpand = await expandServicePagesTranslations({
  stored: savedSite,
  patch: localePatchPayload("he", {
    ...defaultServicePagesForLocale("he"),
    eyeExam: {
      ...defaultServicePagesForLocale("he").eyeExam,
      title: "כותרת ידנית",
    },
  }),
  translate: fakeTranslate,
});
const withManualHe: ServicePagesSettings = persistServicePages(
  savedSite,
  heManualExpand.patch,
);
assert.equal(withManualHe.locales?.he?.eyeExam.title, "כותרת ידנית");
assert.equal(withManualHe.locales?.he?.i18nOrigins?.["eyeExam.title"], "manual");
const expandedKeepManual = await expandServicePagesTranslations({
  stored: withManualHe,
  patch: localePatchPayload("ar", {
    ...arDefaults,
    eyeExam: { ...arDefaults.eyeExam, title: "عنوان ثالث" },
  }),
  translate: fakeTranslate,
});
const keptManualSite = persistServicePages(withManualHe, expandedKeepManual.patch);
assert.equal(keptManualSite.locales?.he?.eyeExam.title, "כותרת ידנית");
assert.equal(keptManualSite.locales?.en?.eyeExam.title, "[en]عنوان ثالث");

const unchangedExpand = await expandServicePagesTranslations({
  stored: storedAr,
  patch: localePatchPayload("ar", {
    ...arDefaults,
    eyeExam: { ...arDefaults.eyeExam, title: "عنوان قديم" },
  }),
  translate: fakeTranslate,
});
const unchangedSaved = persistServicePages(storedAr, unchangedExpand.patch);
assert.equal(unchangedSaved.locales?.he, undefined);

function completeCopy(overrides: Partial<CustomPageCopy> = {}): CustomPageCopy {
  return {
    ...emptyCustomPageCopy(),
    title: "فحص أطفال",
    description: "وصف عربي",
    bookingButtonText: "احجز الآن",
    features: [
      { title: "معتمدون", description: "خبرة", icon: "user-round" },
      { title: "سريع", description: "ثلاثون دقيقة", icon: "clock-3" },
      { title: "", description: "", icon: "shield-check" },
      { title: "", description: "", icon: "eye" },
    ],
    benefitsTitle: "لماذا",
    benefits: ["واحد", "اثنان", "", "", ""],
    warningText: "تنبيه",
    valuesTitle: "دقة",
    valuesText: "بعناية",
    ...overrides,
  };
}

const createdPages = persistCustomPages([], {
  customPageOp: { op: "create", name: "Kids", slug: "kids-exam" },
});
const page = createdPages[0]!;
const customStored: ServicePagesSettings = {
  ...DEFAULT_SERVICE_PAGES,
  customPages: createdPages,
};
const customPatch = {
  customPageOp: {
    op: "update" as const,
    id: page.id,
    expectedRevision: page.revision,
    status: "published" as const,
    locale: "ar" as const,
    copy: completeCopy(),
    sections: page.sections,
    showHeroButton: false,
  },
};
const expandedCustom = await expandServicePagesTranslations({
  stored: customStored,
  patch: customPatch,
  translate: fakeTranslate,
});
const savedCustom = persistCustomPages(createdPages, expandedCustom.patch);
const live = savedCustom[0]!;
assert.equal(live.locales.ar?.title, "فحص أطفال");
assert.equal(live.locales.he?.title, "[he]فحص أطفال");
assert.equal(live.locales.en?.title, "[en]فحص أطفال");
assert.equal(live.locales.he?.complete, true);
assert.equal(live.locales.en?.complete, true);
assert.equal(resolvePublishedCustomPage(savedCustom, "kids-exam", "he")?.copy.title, "[he]فحص أطفال");
assert.equal(resolvePublishedCustomPage(savedCustom, "kids-exam", "en")?.copy.title, "[en]فحص أطفال");

const manualHePage = persistCustomPages(savedCustom, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: live.revision,
    locale: "he",
    copy: completeCopy({ title: "בדיקת ילדים" }),
  },
});
const afterManual = manualHePage[0]!;
const expandedAfterManual = await expandServicePagesTranslations({
  stored: { ...customStored, customPages: manualHePage },
  patch: {
    customPageOp: {
      op: "update" as const,
      id: afterManual.id,
      expectedRevision: afterManual.revision,
      locale: "ar" as const,
      copy: completeCopy({ title: "عنوان جديد للصفحة" }),
      sections: afterManual.sections,
      showHeroButton: false,
    },
  },
  translate: fakeTranslate,
});
const preservedCustom = persistCustomPages(manualHePage, expandedAfterManual.patch);
assert.equal(preservedCustom[0]?.locales.he?.title, "בדיקת ילדים");
assert.equal(preservedCustom[0]?.locales.en?.title, "[en]عنوان جديد للصفحة");

const productsRoute = readFileSync(join(process.cwd(), "app/api/products/route.ts"), "utf8");
assert.match(productsRoute, /PUBLIC_JSON_CACHE_CONTROL/);
assert.match(productsRoute, /maxDuration = 60/);
const settingsRoute = readFileSync(join(process.cwd(), "app/api/settings/route.ts"), "utf8");
assert.match(settingsRoute, /expandServicePagesTranslations/);
assert.match(settingsRoute, /maxDuration = 60/);
assert.match(PUBLIC_JSON_CACHE_CONTROL, /max-age=5/);
assert.match(PUBLIC_JSON_CACHE_CONTROL, /stale-while-revalidate=15/);

const inventory = readFileSync(join(process.cwd(), "app/admin/inventory/page.tsx"), "utf8");
assert.match(inventory, /translationPartial/);
const servicePages = readFileSync(join(process.cwd(), "app/admin/service-pages/page.tsx"), "utf8");
assert.match(servicePages, /setDrafts\(\{\}\)/);

console.log("test-auto-translate-persist: ok");
}

void main();
