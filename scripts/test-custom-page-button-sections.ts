import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expandServicePagesTranslations } from "../lib/content-i18n";
import {
  CONTENT_FIELD_IDS,
  customPageFieldIssues,
} from "../lib/content-editor-validation";
import {
  ADDABLE_CUSTOM_SECTION_TYPES,
  CustomPageError,
  isCustomPageLocaleComplete,
  pageHasVisibleButton,
  pageUsesSectionButtons,
  persistCustomPages,
  resolvePublishedCustomPage,
  resolveSectionButtonHref,
  resolveSectionButtonLabel,
  seedSectionButtonFromLegacy,
  visibleButtonSections,
} from "../lib/custom-service-pages";
import type {
  CustomPageCopy,
  CustomPageSection,
  ServicePagesSettings,
} from "../lib/types";
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
const builder = readFileSync(
  join(root, "components/admin/CustomPageBuilder.tsx"),
  "utf8",
);
const view = readFileSync(
  join(root, "components/services/CustomServicePageView.tsx"),
  "utf8",
);
const modal = readFileSync(join(root, "components/admin/AdminModal.tsx"), "utf8");
const css = readFileSync(join(root, "app/globals.css"), "utf8");
const arDict = readFileSync(join(root, "lib/i18n/dictionaries/ar.ts"), "utf8");

assert.ok(ADDABLE_CUSTOM_SECTION_TYPES.includes("primaryButton"));
assert.ok(ADDABLE_CUSTOM_SECTION_TYPES.includes("secondaryButton"));
assert.ok(!ADDABLE_CUSTOM_SECTION_TYPES.includes("bookingCta" as never));

assert.match(builder, /sectionPrimaryButton/);
assert.match(builder, /sectionSecondaryButton/);
assert.match(builder, /seedSectionButtonFromLegacy/);
assert.match(builder, /isButtonSectionType\(section\.type\)/);
assert.match(builder, /usesSectionButtons \? null/);
assert.match(builder, /preventClose=\{saving\}/);
assert.match(builder, /csp-save-scope-spinner/);
assert.match(builder, /saveCurrentLanguageWait/);
assert.match(builder, /saveAllLanguagesWait/);
assert.match(builder, /saveRetry/);
assert.match(builder, /retrySave/);
assert.match(builder, /if \(saving\) return/);
assert.match(builder, /setSaveBusy\(syncLocales\)/);
assert.match(view, /SectionCta/);
assert.match(view, /pageUsesSectionButtons\(page\.sections\)/);
assert.match(view, /isButtonSectionType\(section\.type\)/);
assert.match(modal, /preventClose/);
assert.match(css, /\.csp-page-btn-wrap\.is-center/);
assert.match(css, /\.csp-page-btn\.is-secondary/);
assert.match(css, /\.csp-page-btn-wrap\.is-full-mobile/);
assert.match(css, /@keyframes csp-save-spin/);
assert.match(arDict, /جارٍ حفظ التغييرات، يرجى الانتظار/);
assert.match(arDict, /جارٍ حفظ التغييرات وترجمة المحتوى إلى جميع اللغات/);
assert.match(arDict, /زر رئيسي/);
assert.match(arDict, /زر ثانوي/);

const created = createdPages();
const page = created[0]!;
assert.equal(page.showHeroButton, false);
assert.deepEqual(page.sections, []);
assert.equal(pageUsesSectionButtons(page.sections), false);
assert.equal(pageHasVisibleButton(page.sections, page.showHeroButton), false);
assert.equal(
  isCustomPageLocaleComplete(page.sections, completeCopy({ bookingButtonText: "" }), false),
  true,
);

const noButtonIssues = customPageFieldIssues({
  name: "Kids Exam",
  slug: "kids-exam",
  sections: [],
  copy: completeCopy({ bookingButtonText: "" }),
  showHeroButton: false,
  ctaKind: "external",
  ctaHref: "javascript:alert(1)",
});
assert.equal(
  noButtonIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.ctaExternal),
  false,
);
assert.equal(
  noButtonIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.bookingButton),
  false,
);

const primary: CustomPageSection = {
  id: "sec_primary",
  type: "primaryButton",
  button: {
    style: "primary",
    align: "center",
    ctaKind: "book",
    locales: { ar: { label: "احجز الآن" } },
  },
};
const secondary: CustomPageSection = {
  id: "sec_secondary",
  type: "secondaryButton",
  button: {
    style: "secondary",
    align: "left",
    fullWidthMobile: true,
    ctaKind: "internal",
    ctaHref: "/shop",
    locales: { ar: { label: "تسوق" }, he: { label: "חנות" } },
  },
};
const hiddenPrimary: CustomPageSection = {
  ...primary,
  id: "sec_hidden",
  hidden: true,
  button: {
    ...primary.button!,
    ctaKind: "external",
    ctaHref: "javascript:alert(1)",
    locales: {},
  },
};

assert.equal(pageUsesSectionButtons([primary, secondary]), true);
assert.equal(visibleButtonSections([primary, hiddenPrimary]).length, 1);
assert.equal(resolveSectionButtonLabel(primary, "ar"), "احجز الآن");
assert.equal(resolveSectionButtonLabel(primary, "he"), "");
assert.equal(resolveSectionButtonHref(secondary), "/shop");
assert.equal(pageHasVisibleButton([hiddenPrimary], true), false);

const hiddenIssues = customPageFieldIssues({
  name: "Kids Exam",
  slug: "kids-exam",
  sections: [hiddenPrimary],
  copy: completeCopy({ bookingButtonText: "" }),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
  locale: "ar",
});
assert.equal(
  hiddenIssues.some((item) => item.fieldId.startsWith("csp-btn-")),
  false,
);
assert.equal(
  isCustomPageLocaleComplete([hiddenPrimary], completeCopy({ bookingButtonText: "" }), false, "ar"),
  true,
);

const missingLabelIssues = customPageFieldIssues({
  name: "Kids Exam",
  slug: "kids-exam",
  sections: [{ ...primary, button: { ...primary.button!, locales: {} } }],
  copy: completeCopy({ bookingButtonText: "" }),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
  locale: "ar",
});
assert.equal(
  missingLabelIssues.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.buttonLabel("sec_primary"),
  ),
  true,
);

const missingHrefIssues = customPageFieldIssues({
  name: "Kids Exam",
  slug: "kids-exam",
  sections: [
    {
      ...secondary,
      button: { ...secondary.button!, ctaHref: "javascript:alert(1)" },
    },
  ],
  copy: completeCopy(),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
  locale: "ar",
});
assert.equal(
  missingHrefIssues.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.buttonInternal("sec_secondary"),
  ),
  true,
);

const HebrewMissing = customPageFieldIssues({
  name: "Kids Exam",
  slug: "kids-exam",
  sections: [primary],
  copy: completeCopy(),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
  locale: "he",
});
assert.equal(
  HebrewMissing.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.buttonLabel("sec_primary"),
  ),
  true,
);
assert.equal(
  isCustomPageLocaleComplete([primary], completeCopy(), false, "ar"),
  true,
);
assert.equal(
  isCustomPageLocaleComplete([primary], completeCopy(), false, "he"),
  false,
);

assert.throws(
  () =>
    persistCustomPages(created, {
      customPageOp: {
        op: "update",
        id: page.id,
        expectedRevision: page.revision,
        sections: [
          {
            ...secondary,
            button: { ...secondary.button!, ctaHref: "/admin" },
          },
        ],
        locale: "ar",
        copy: completeCopy(),
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_INVALID_CTA",
);

const seeded = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: page.id,
    expectedRevision: page.revision,
    status: "published",
    showHeroButton: false,
    sections: [
      { id: "sec_hero", type: "heroMedia" },
      primary,
      { id: "sec_grid", type: "featureGrid" },
      secondary,
    ],
    locale: "ar",
    copy: completeCopy(),
  },
});
const live = seeded[0]!;
assert.equal(live.showHeroButton, false);
assert.deepEqual(
  live.sections.map((section) => section.type),
  ["heroMedia", "primaryButton", "featureGrid", "secondaryButton"],
);
assert.equal(live.locales.ar?.complete, true);
assert.equal(resolveSectionButtonHref(live.sections[1]!), "/book");
assert.equal(resolveSectionButtonHref(live.sections[3]!), "/shop");

const moved = persistCustomPages(seeded, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: live.revision,
    sections: [
      { id: "sec_hero", type: "heroMedia" },
      { id: "sec_grid", type: "featureGrid" },
      secondary,
      primary,
    ],
    locale: "ar",
    copy: completeCopy(),
  },
});
assert.deepEqual(
  moved[0]?.sections.map((section) => section.type),
  ["heroMedia", "featureGrid", "secondaryButton", "primaryButton"],
);

const stored: ServicePagesSettings = {
  ...DEFAULT_SERVICE_PAGES,
  customPages: moved,
};

async function main() {
  const currentPatch = {
    customPageOp: {
      op: "update" as const,
      id: moved[0]!.id,
      expectedRevision: moved[0]!.revision,
      syncLocales: "current" as const,
      locale: "he" as const,
      showHeroButton: false,
      sections: [
        { id: "sec_hero", type: "heroMedia" as const },
        {
          ...primary,
          button: {
            ...primary.button!,
            align: "right" as const,
            locales: { he: { label: "קבעו תור" } },
          },
        },
      ],
      copy: completeCopy({
        title: "בדיקת ילדים",
        description: "תיאור בעברית.",
        bookingButtonText: "קבעו תור",
      }),
    },
  };
  const expandedCurrent = await expandServicePagesTranslations({
    stored,
    patch: currentPatch,
    translate: fakeTranslate,
  });
  const savedCurrent = persistCustomPages(moved, expandedCurrent.patch);
  const afterCurrent = savedCurrent[0]!;
  assert.equal(afterCurrent.layouts?.he?.sections.length, 2);
  assert.equal(afterCurrent.layouts?.he?.sections[1]?.button?.align, "right");
  assert.equal(
    afterCurrent.layouts?.he?.sections[1]?.button?.locales?.he?.label,
    "קבעו תור",
  );
  assert.equal(afterCurrent.sections.length, 4);
  assert.equal(
    afterCurrent.sections.find((section) => section.id === "sec_primary")?.button
      ?.locales?.ar?.label,
    "احجز الآن",
  );
  assert.equal(
    resolvePublishedCustomPage(savedCurrent, "kids-exam", "ar")?.page.sections
      .length,
    4,
  );
  assert.equal(
    resolvePublishedCustomPage(savedCurrent, "kids-exam", "he")?.page.sections
      .length,
    2,
  );
  assert.equal(
    resolveSectionButtonLabel(
      resolvePublishedCustomPage(savedCurrent, "kids-exam", "he")!.page.sections[1]!,
      "he",
    ),
    "קבעו תור",
  );

  const allPatch = {
    customPageOp: {
      op: "update" as const,
      id: afterCurrent.id,
      expectedRevision: afterCurrent.revision,
      syncLocales: "all" as const,
      locale: "ar" as const,
      showHeroButton: false,
      sections: [
        { id: "sec_hero", type: "heroMedia" as const },
        {
          ...primary,
          button: {
            ...primary.button!,
            align: "center" as const,
            style: "primary" as const,
            locales: { ar: { label: "زر موحد" } },
          },
        },
        secondary,
      ],
      copy: completeCopy({ title: "نسخة موحدة" }),
    },
  };
  const expandedAll = await expandServicePagesTranslations({
    stored: { ...stored, customPages: savedCurrent },
    patch: allPatch,
    translate: fakeTranslate,
  });
  const savedAll = persistCustomPages(savedCurrent, expandedAll.patch);
  const afterAll = savedAll[0]!;
  assert.equal(afterAll.layouts?.ar?.sections.length, 3);
  assert.equal(afterAll.layouts?.he?.sections.length, 3);
  assert.equal(afterAll.layouts?.en?.sections.length, 3);
  assert.equal(afterAll.layouts?.he?.sections[1]?.button?.align, "center");
  assert.equal(afterAll.layouts?.en?.sections[2]?.button?.style, "secondary");
  assert.equal(
    afterAll.layouts?.he?.sections[1]?.button?.locales?.he?.label,
    "[he]زر موحد",
  );
  assert.equal(
    afterAll.layouts?.en?.sections[1]?.button?.locales?.en?.label,
    "[en]زر موحد",
  );
  assert.equal(
    afterAll.layouts?.ar?.sections[1]?.button?.locales?.ar?.label,
    "زر موحد",
  );

  const legacy = persistCustomPages([], {
    customPageOp: { op: "create", name: "Legacy", slug: "legacy-care" },
  });
  const withLegacyButton = persistCustomPages(legacy, {
    customPageOp: {
      op: "update",
      id: legacy[0]!.id,
      expectedRevision: legacy[0]!.revision,
      status: "published",
      showHeroButton: true,
      ctaKind: "internal",
      ctaHref: "/about",
      sections: [
        { id: "sec_hero", type: "heroMedia" },
        { id: "sec_banner", type: "bookingCta" },
      ],
      locale: "ar",
      copy: completeCopy(),
    },
  });
  const legacyPage = withLegacyButton[0]!;
  assert.equal(legacyPage.showHeroButton, true);
  assert.equal(pageUsesSectionButtons(legacyPage.sections), false);
  assert.equal(pageHasVisibleButton(legacyPage.sections, true), true);
  assert.equal(legacyPage.ctaHref, "/about");
  assert.ok(resolvePublishedCustomPage(withLegacyButton, "legacy-care", "ar"));
  assert.doesNotMatch(
    JSON.stringify(legacyPage.sections),
    /primaryButton|secondaryButton/,
  );

  const migratedButton = seedSectionButtonFromLegacy("primaryButton", {
    ctaKind: legacyPage.ctaKind,
    bookingType: legacyPage.bookingType,
    ctaHref: legacyPage.ctaHref,
    labels: { ar: legacyPage.locales.ar?.bookingButtonText },
  });
  assert.equal(migratedButton.style, "primary");
  assert.equal(migratedButton.ctaKind, "internal");
  assert.equal(migratedButton.ctaHref, "/about");
  assert.equal(migratedButton.locales?.ar?.label, "احجز الآن");

  const migrated = persistCustomPages(withLegacyButton, {
    customPageOp: {
      op: "update",
      id: legacyPage.id,
      expectedRevision: legacyPage.revision,
      showHeroButton: false,
      sections: [
        { id: "sec_hero", type: "heroMedia" },
        { id: "sec_banner", type: "bookingCta", hidden: true },
        { id: "sec_new_btn", type: "primaryButton", button: migratedButton },
      ],
      locale: "ar",
      copy: completeCopy(),
    },
  });
  assert.equal(migrated[0]?.showHeroButton, false);
  assert.equal(pageUsesSectionButtons(migrated[0]!.sections), true);
  assert.equal(
    visibleButtonSections(migrated[0]!.sections).map((section) => section.id).join(),
    "sec_new_btn",
  );
  assert.equal(
    migrated[0]?.sections.filter((section) => section.type === "primaryButton")
      .length,
    1,
  );

  console.log("test-custom-page-button-sections: ok");
}

void main();
