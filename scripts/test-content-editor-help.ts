import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  builtInPageFieldIssues,
  CONTENT_FIELD_IDS,
  customPageFieldIssues,
  missingFieldIdSet,
  wizardStepForSection,
} from "../lib/content-editor-validation";
import { CUSTOM_SECTION_HELP_KIND, SECTION_HELP_I18N } from "../lib/content-editor-help";
import { emptyCustomPageCopy, isCustomPageLocaleComplete } from "../lib/custom-service-pages";
import { CUSTOM_SECTION_TYPES } from "../lib/types";
import type { CustomPageCopy, ServicePagesLocaleBundle } from "../lib/types";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";

function completeCopy(overrides: Partial<CustomPageCopy> = {}): CustomPageCopy {
  return {
    ...emptyCustomPageCopy(),
    title: "Kids eye exam",
    description: "A full exam for children.",
    bookingButtonText: "Book now",
    features: [
      { title: "Certified", description: "Trusted care", icon: "user-round" },
      { title: "Fast", description: "30 minutes", icon: "clock-3" },
      { title: "", description: "", icon: "shield-check" },
      { title: "", description: "", icon: "eye" },
    ],
    benefitsTitle: "Why it matters",
    benefits: ["One", "Two", "", "", ""],
    warningText: "Professional fitting required.",
    valuesTitle: "Accuracy",
    valuesText: "Measured with care.",
    ...overrides,
  };
}

const emptyHero = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_hero", type: "heroMedia" }],
  copy: emptyCustomPageCopy(),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  emptyHero.some((item) => item.fieldId === CONTENT_FIELD_IDS.title && item.requirement === "display"),
  true,
);
assert.equal(
  emptyHero.some((item) => item.fieldId === CONTENT_FIELD_IDS.description),
  true,
);
assert.equal(
  emptyHero.some((item) => item.messageKey === "admin.servicePages.issueTitle"),
  false,
);

const saveIssues = customPageFieldIssues({
  name: "  ",
  slug: "book",
  sections: [],
  copy: completeCopy(),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  saveIssues.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.pageName && item.requirement === "save",
  ),
  true,
);
assert.equal(
  saveIssues.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.pageSlug && item.requirement === "save",
  ),
  true,
);

const featureIssues = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_cards", type: "featureGrid" }],
  copy: completeCopy({
    features: [
      { title: "Certified", description: "Trusted care", icon: "user-round" },
      { title: "", description: "", icon: "clock-3" },
      { title: "", description: "", icon: "shield-check" },
      { title: "", description: "", icon: "eye" },
    ],
  }),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  featureIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.featureTitle(2)),
  true,
);
assert.equal(
  featureIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.featureDescription(2)),
  true,
);
assert.equal(
  featureIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.featureTitle(3)),
  false,
);

const laterCardsComplete = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_cards", type: "featureGrid" }],
  copy: completeCopy({
    features: [
      { title: "", description: "", icon: "user-round" },
      { title: "", description: "", icon: "clock-3" },
      { title: "Certified", description: "Trusted care", icon: "shield-check" },
      { title: "Fast", description: "30 minutes", icon: "eye" },
    ],
  }),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  laterCardsComplete.some((item) => item.messageKey.includes("missingFeature")),
  false,
);

const hiddenGrid = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_cards", type: "featureGrid", hidden: true }],
  copy: emptyCustomPageCopy(),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  hiddenGrid.some((item) => item.fieldId.startsWith("csp-feature-")),
  false,
);

const ctaIssues = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_cta", type: "bookingCta" }],
  copy: completeCopy({ bookingButtonText: "" }),
  showHeroButton: false,
  ctaKind: "external",
  ctaHref: "javascript:alert(1)",
});
assert.equal(
  ctaIssues.some(
    (item) => item.fieldId === CONTENT_FIELD_IDS.ctaExternal && item.requirement === "save",
  ),
  true,
);
assert.equal(
  ctaIssues.some(
    (item) =>
      item.fieldId === CONTENT_FIELD_IDS.bookingButton && item.requirement === "display",
  ),
  true,
);

const benefitIssues = customPageFieldIssues({
  name: "Clinic",
  slug: "kids-exam",
  sections: [{ id: "sec_list", type: "benefitsList" }],
  copy: completeCopy({ benefitsTitle: "", benefits: ["One", "", "", "", ""] }),
  showHeroButton: false,
  ctaKind: "book",
  ctaHref: "",
});
assert.equal(
  benefitIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.benefitsTitle),
  true,
);
assert.equal(
  benefitIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.benefit(2)),
  true,
);
assert.equal(
  benefitIssues.some((item) => item.fieldId === CONTENT_FIELD_IDS.benefit(1)),
  false,
);

assert.equal(
  isCustomPageLocaleComplete(
    [{ id: "sec_list", type: "benefitsList" }],
    completeCopy({ benefits: ["One", "Two", "", "", ""] }),
  ),
  true,
);

const defaults = defaultServicePagesForLocale("en") as ServicePagesLocaleBundle;
const homeIssues = builtInPageFieldIssues("homepage", {
  ...defaults,
  homepage: {
    hero: {
      title: "",
      serviceLabels: ["A", "B"],
      bookingButtonText: "Book",
      shopButtonText: "",
    },
  },
});
assert.equal(
  homeIssues.some((item) => item.messageKey === "admin.servicePages.missingTitle"),
  true,
);
assert.equal(
  homeIssues.some((item) => item.messageKey === "admin.servicePages.missingShopButton"),
  true,
);

assert.equal(wizardStepForSection("page-details"), 1);
assert.equal(wizardStepForSection("sec_hero"), 3);
assert.deepEqual([...missingFieldIdSet(emptyHero)].includes(CONTENT_FIELD_IDS.title), true);

for (const type of CUSTOM_SECTION_TYPES) {
  assert.equal(Boolean(CUSTOM_SECTION_HELP_KIND[type]), true);
  assert.equal(Boolean(SECTION_HELP_I18N[CUSTOM_SECTION_HELP_KIND[type]]), true);
}

const editorPage = readFileSync(
  join(process.cwd(), "app/admin/service-pages/page.tsx"),
  "utf8",
);
const builder = readFileSync(
  join(process.cwd(), "components/admin/CustomPageBuilder.tsx"),
  "utf8",
);
const fold = readFileSync(
  join(process.cwd(), "components/admin/content-editor/EditorSection.tsx"),
  "utf8",
);
const help = readFileSync(
  join(process.cwd(), "components/admin/content-editor/SectionHelpPopover.tsx"),
  "utf8",
);
assert.doesNotMatch(editorPage, /sectionAdminName/);
assert.doesNotMatch(builder, /sectionAdminName/);
assert.doesNotMatch(editorPage, /adminTitle\(/);
assert.doesNotMatch(builder, /setSectionAdminLabel/);
assert.match(editorPage, /SectionHelpPopover/);
assert.match(builder, /SectionHelpPopover/);
assert.match(fold, /help/);
assert.match(help, /featureGrid/);
assert.match(help, /benefitsList/);
assert.match(help, /heroMedia/);
assert.match(help, /valuesStrip/);
assert.match(help, /bookingCta/);
assert.match(help, /notice/);
assert.match(help, /products/);
assert.match(builder, /MissingFieldsBanner/);
assert.match(editorPage, /MissingFieldsBanner/);
assert.match(builder, /fieldMeta\(CONTENT_FIELD_IDS\.title/);

const en = readFileSync(join(process.cwd(), "lib/i18n/dictionaries/en.ts"), "utf8");
const ar = readFileSync(join(process.cwd(), "lib/i18n/dictionaries/ar.ts"), "utf8");
const he = readFileSync(join(process.cwd(), "lib/i18n/dictionaries/he.ts"), "utf8");
assert.match(en, /Benefits Cards/);
assert.match(en, /Rating Strip/);
assert.match(en, /Bottom Banner/);
assert.match(ar, /بطاقات الفوائد/);
assert.match(ar, /شريط التقييم/);
assert.match(ar, /الشريط السفلي/);
assert.match(he, /כרטיסי יתרונות/);
assert.match(he, /פס דירוג/);
assert.match(he, /באנר תחתון/);
assert.match(en, /Required to save/);
assert.match(ar, /مطلوب للحفظ/);
assert.match(he, /נדרש לשמירה/);

console.log("content-editor-help tests passed");
