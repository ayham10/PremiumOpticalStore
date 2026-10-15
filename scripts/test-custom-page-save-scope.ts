import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandServicePagesTranslations } from "../lib/content-i18n";
import {
  captureCustomPageLayout,
  customPageSiblingCustomizations,
  persistCustomPages,
  resolveCustomPageLayout,
  resolvePublishedCustomPage,
} from "../lib/custom-service-pages";
import { shouldTranslateField } from "../lib/translate-text";
import type { CustomPageCopy, CustomPageSection, ServicePagesSettings } from "../lib/types";
import { DEFAULT_SERVICE_PAGES } from "../lib/service-pages";

const fakeTranslate = async (text: string, _from: string, to: string) =>
  `[${to}]${text}`;

function completeCopy(overrides: Partial<CustomPageCopy> = {}): CustomPageCopy {
  return {
    complete: false,
    eyebrow: "Care",
    title: "فحص أطفال",
    description: "وصف كامل للفحص.",
    bookingButtonText: "احجز الآن",
    features: [
      { title: "معتمدون", description: "خبرة", icon: "user-round" },
      { title: "سريع", description: "ثلاثون دقيقة", icon: "clock-3" },
      { title: "", description: "", icon: "shield-check" },
      { title: "", description: "", icon: "eye" },
    ],
    benefitsTitle: "لماذا",
    benefits: ["واحد", "اثنان", "", "", ""],
    warningTitle: "",
    warningText: "تنبيه",
    valuesTitle: "دقة",
    valuesText: "بعناية",
    privacyText: "",
    homeTitle: "فحص أطفال",
    homeSubtitle: "عناية",
    ...overrides,
  };
}

function createdPages() {
  return persistCustomPages([], {
    customPageOp: { op: "create", name: "Kids Exam", slug: "kids-exam" },
  });
}

const root = process.cwd();
const builder = readFileSync(join(root, "components/admin/CustomPageBuilder.tsx"), "utf8");
assert.match(builder, /saveAllLanguages/);
assert.match(builder, /saveCurrentLanguage/);
assert.match(builder, /syncLocales: "all" \| "current"/);
assert.match(builder, /submit\("current"/);
assert.match(builder, /submit\("all"/);
assert.match(builder, /overwriteManual/);
assert.match(builder, /invalidatePublicCache\("settings:"\)/);
assert.match(builder, /oyon:branding-saved/);
assert.match(builder, /saveScopeOverwriteTitle/);
assert.doesNotMatch(builder, /onSave=\{\(\) => void submit\(\)\}/);

assert.match(
  readFileSync(join(root, "lib/content-i18n.ts"), "utf8"),
  /syncLocales === "current"/,
);

assert.equal(
  shouldTranslateField({
    source: "عنوان جديد",
    previous: "عنوان",
    target: "כותרת ידנית",
    targetLocale: "he",
    fillMissing: true,
    targetOrigin: "manual",
  }),
  false,
);
assert.equal(
  shouldTranslateField({
    source: "عنوان جديد",
    previous: "عنوان",
    target: "כותרת ידנית",
    targetLocale: "he",
    fillMissing: true,
    targetOrigin: "manual",
    overwriteManual: true,
  }),
  true,
);

async function main() {
const created = createdPages();
const page = created[0]!;
const oldSections: CustomPageSection[] = [
  { id: "sec_hero", type: "heroMedia" },
];
const newSections: CustomPageSection[] = [
  { id: "sec_hero", type: "heroMedia" },
  { id: "sec_grid", type: "featureGrid" },
];

const seeded = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: page.id,
    expectedRevision: page.revision,
    status: "published",
    sections: oldSections,
    showHeroButton: false,
    locale: "ar",
    copy: completeCopy(),
    locales: {
      he: completeCopy({
        title: "בדיקת ילדים",
        description: "תיאור בעברית.",
        bookingButtonText: "קבעו תור",
        origins: { title: "manual" },
      }),
      en: completeCopy({
        title: "[en]فحص أطفال",
        description: "[en]وصف كامل للفحص.",
        bookingButtonText: "[en]احجز الآن",
        origins: { title: "machine", description: "machine", bookingButtonText: "machine" },
      }),
    },
  },
});
const live = seeded[0]!;
assert.equal(live.locales.he?.title, "בדיקת ילדים");
assert.equal(resolvePublishedCustomPage(seeded, "kids-exam", "he")?.page.sections.length, 1);

const stored: ServicePagesSettings = {
  ...DEFAULT_SERVICE_PAGES,
  customPages: seeded,
};

const currentOnlyPatch = {
  customPageOp: {
    op: "update" as const,
    id: live.id,
    expectedRevision: live.revision,
    syncLocales: "current" as const,
    locale: "ar" as const,
    copy: completeCopy({ title: "تخطيط عربي جديد" }),
    sections: newSections,
    showHeroButton: false,
    productIds: ["prod_ar_only"],
    heroMedia: { kind: "image" as const, url: "https://example.com/ar.jpg" },
  },
};

const expandedCurrent = await expandServicePagesTranslations({
  stored,
  patch: currentOnlyPatch,
  translate: fakeTranslate,
});
const expandedOp = (expandedCurrent.patch as { customPageOp: { locales?: unknown } })
  .customPageOp;
assert.equal(expandedOp.locales, undefined);
assert.equal(expandedCurrent.failures.length, 0);

const savedCurrent = persistCustomPages(seeded, expandedCurrent.patch);
const afterCurrent = savedCurrent[0]!;
assert.equal(afterCurrent.id, live.id);
assert.equal(afterCurrent.slug, "kids-exam");
assert.equal(afterCurrent.status, "published");
assert.equal(afterCurrent.locales.ar?.title, "تخطيط عربي جديد");
assert.equal(afterCurrent.locales.he?.title, "בדיקת ילדים");
assert.equal(afterCurrent.locales.en?.title, "[en]فحص أطفال");
assert.equal(afterCurrent.sections.length, 1);
assert.equal(afterCurrent.sections[0]?.id, "sec_hero");
assert.equal(afterCurrent.productIds?.length, 0);
assert.equal(afterCurrent.layouts?.ar?.sections.length, 2);
assert.equal(afterCurrent.layouts?.ar?.productIds?.[0], "prod_ar_only");
assert.equal(afterCurrent.layouts?.ar?.heroMedia?.url, "https://example.com/ar.jpg");
assert.equal(afterCurrent.layouts?.he, undefined);
assert.equal(afterCurrent.layouts?.en, undefined);

const arPublic = resolvePublishedCustomPage(savedCurrent, "kids-exam", "ar");
const hePublic = resolvePublishedCustomPage(savedCurrent, "kids-exam", "he");
assert.equal(arPublic?.page.sections.length, 2);
assert.equal(arPublic?.page.productIds?.[0], "prod_ar_only");
assert.equal(arPublic?.copy.title, "تخطيط عربي جديد");
assert.equal(hePublic?.page.sections.length, 1);
assert.equal(hePublic?.page.productIds?.length, 0);
assert.equal(hePublic?.copy.title, "בדיקת ילדים");
assert.notEqual(
  captureCustomPageLayout(arPublic!.page).sections.length,
  captureCustomPageLayout(hePublic!.page).sections.length,
);

assert.deepEqual(
  customPageSiblingCustomizations(
    afterCurrent,
    "ar",
    afterCurrent.layouts!.ar!,
  ),
  ["he"],
);

const allPatch = {
  customPageOp: {
    op: "update" as const,
    id: afterCurrent.id,
    expectedRevision: afterCurrent.revision,
    syncLocales: "all" as const,
    locale: "ar" as const,
    copy: completeCopy({ title: "نسخة موحدة" }),
    sections: newSections,
    showHeroButton: false,
    productIds: ["prod_shared"],
    heroMedia: { kind: "image" as const, url: "https://example.com/all.jpg" },
  },
};

const expandedAllKeepManual = await expandServicePagesTranslations({
  stored: { ...stored, customPages: savedCurrent },
  patch: allPatch,
  translate: fakeTranslate,
});
const savedAllKeep = persistCustomPages(savedCurrent, expandedAllKeepManual.patch);
assert.equal(savedAllKeep[0]?.locales.he?.title, "בדיקת ילדים");
assert.equal(savedAllKeep[0]?.locales.en?.title, "[en]نسخة موحدة");
assert.equal(savedAllKeep[0]?.layouts?.he?.sections.length, 2);
assert.equal(savedAllKeep[0]?.layouts?.en?.productIds?.[0], "prod_shared");
assert.equal(
  resolvePublishedCustomPage(savedAllKeep, "kids-exam", "he")?.page.sections.length,
  2,
);
assert.equal(
  resolvePublishedCustomPage(savedAllKeep, "kids-exam", "en")?.page.heroMedia?.url,
  "https://example.com/all.jpg",
);

const expandedAllOverwrite = await expandServicePagesTranslations({
  stored: { ...stored, customPages: savedCurrent },
  patch: {
    customPageOp: {
      ...allPatch.customPageOp,
      overwriteManual: true,
    },
  },
  translate: fakeTranslate,
});
const savedAllOverwrite = persistCustomPages(
  savedCurrent,
  expandedAllOverwrite.patch,
);
assert.equal(savedAllOverwrite[0]?.locales.he?.title, "[he]نسخة موحدة");
assert.equal(savedAllOverwrite[0]?.locales.en?.title, "[en]نسخة موحدة");
assert.equal(
  resolveCustomPageLayout(savedAllOverwrite[0]!, "he").sections.length,
  resolveCustomPageLayout(savedAllOverwrite[0]!, "ar").sections.length,
);

const heOnly = persistCustomPages(savedAllOverwrite, {
  customPageOp: {
    op: "update",
    id: savedAllOverwrite[0]!.id,
    expectedRevision: savedAllOverwrite[0]!.revision,
    syncLocales: "current",
    locale: "he",
    copy: completeCopy({
      title: "פריסה עברית בלבד",
      description: "תיאור בעברית.",
      bookingButtonText: "קבעו תור",
    }),
    sections: [{ id: "sec_he_only", type: "notice" }],
    showHeroButton: true,
  },
});
assert.equal(heOnly[0]?.locales.ar?.title, "نسخة موحدة");
assert.equal(heOnly[0]?.layouts?.he?.sections[0]?.id, "sec_he_only");
assert.equal(heOnly[0]?.layouts?.ar?.sections.length, 2);
assert.equal(
  resolvePublishedCustomPage(heOnly, "kids-exam", "he")?.page.sections[0]?.id,
  "sec_he_only",
);
assert.equal(
  resolvePublishedCustomPage(heOnly, "kids-exam", "ar")?.page.sections.length,
  2,
);

console.log("test-custom-page-save-scope: ok");
}

void main();
