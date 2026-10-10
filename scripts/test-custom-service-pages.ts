import assert from "node:assert/strict";
import {
  ADDABLE_CUSTOM_SECTION_TYPES,
  attachProductIds,
  bookingHrefForPage,
  detachProductId,
  emptyCustomPageCopy,
  homepageCustomCards,
  isCustomPageLocaleComplete,
  listCustomPagesForEditor,
  MAX_CUSTOM_PAGES,
  MAX_PAGE_PRODUCTS,
  normalizeCustomPages,
  normalizeCustomServicePage,
  persistCustomPages,
  publicCustomPages,
  RESERVED_SERVICE_SLUGS,
  resolveCtaHref,
  resolveCustomPageProducts,
  resolvePublishedCustomPage,
  resolveSectionArticle,
  sanitizeArticleBody,
  sanitizeArticleHeading,
  sanitizeExternalUrl,
  sanitizeInternalPath,
  uniqueProductIds,
  visibleCustomBenefits,
  visibleCustomFeatures,
  visibleCustomSections,
  CustomPageConflictError,
  CustomPageError,
} from "../lib/custom-service-pages";
import {
  fileFingerprint,
  galleryWithoutDuplicate,
  validateImageFile,
} from "../lib/media-upload";
import {
  localePatchPayload,
  persistServicePages,
  publicServicePages,
} from "../lib/service-pages";
import { defaultServicePagesForLocale } from "../lib/service-pages-defaults";
import type { CustomPageCopy, CustomServicePage } from "../lib/types";

function completeCopy(overrides: Partial<CustomPageCopy> = {}): CustomPageCopy {
  return {
    complete: false,
    eyebrow: "Care",
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
    warningTitle: "",
    warningText: "Professional fitting required.",
    valuesTitle: "Accuracy",
    valuesText: "Measured with care.",
    privacyText: "",
    homeTitle: "Kids exam",
    homeSubtitle: "Gentle care",
    ...overrides,
  };
}

function createdPages() {
  return persistCustomPages([], {
    customPageOp: {
      op: "create",
      name: "Kids Exam",
      slug: "Kids Exam",
      template: "eye-exam",
    },
  });
}

const placeholders = emptyCustomPageCopy();
assert.equal(placeholders.title, "");
assert.equal(placeholders.features[0]?.icon, "user-round");
assert.deepEqual(visibleCustomBenefits(placeholders.benefits), []);
assert.deepEqual(visibleCustomBenefits(["One", "Two", "", "  ", ""]), ["One", "Two"]);
assert.deepEqual(
  visibleCustomFeatures([
    { title: "A", description: "B" },
    { title: "", description: "" },
    { title: "  ", description: "   " },
  ]),
  [{ title: "A", description: "B" }],
);
assert.equal(
  isCustomPageLocaleComplete(
    [{ id: "b", type: "benefitsList" }],
    completeCopy({ benefits: ["One", "Two", "", "", ""] }),
  ),
  true,
);
assert.equal(
  isCustomPageLocaleComplete(
    [{ id: "b", type: "benefitsList" }],
    completeCopy({ benefits: ["One", "", "", "", ""] }),
  ),
  false,
);
const created = createdPages();
assert.equal(created.length, 1);
assert.equal(created[0]?.slug, "kids-exam");
assert.equal(created[0]?.status, "draft");
assert.equal(created[0]?.template, "eye-exam");
assert.equal(created[0]?.showHeroButton, true);
assert.equal(created[0]?.ctaKind, "book");
assert.deepEqual(created[0]?.productIds, []);
assert.deepEqual(created[0]?.sections, []);
const createdIndependent = persistCustomPages([], {
  customPageOp: { op: "create", name: "Night Clinic", slug: "night-clinic" },
});
assert.equal(createdIndependent[0]?.slug, "night-clinic");
assert.deepEqual(createdIndependent[0]?.sections, []);
assert.equal(createdIndependent[0]?.template, "eye-exam");
assert.equal(created[0]?.locales.ar, undefined);
assert.equal(
  isCustomPageLocaleComplete(created[0]!.sections, placeholders),
  false,
);

assert.throws(
  () =>
    persistCustomPages(created, {
      customPageOp: { op: "create", name: "X", slug: "eye-exams", template: "eye-exam" },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_RESERVED",
);
assert.ok(RESERVED_SERVICE_SLUGS.has("book"));
assert.ok(RESERVED_SERVICE_SLUGS.has("contact-lenses"));

assert.throws(
  () =>
    persistCustomPages(created, {
      customPageOp: {
        op: "create",
        name: "Dup",
        slug: "kids-exam",
        template: "eye-exam",
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_SLUG_TAKEN",
);

const page = created[0]!;
assert.throws(
  () =>
    persistCustomPages(created, {
      customPageOp: {
        op: "update",
        id: page.id,
        expectedRevision: page.revision + 1,
        locale: "ar",
        copy: completeCopy(),
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageConflictError && error.pageId === page.id,
);

const arabicSaved = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: page.id,
    expectedRevision: page.revision,
    locale: "ar",
    copy: completeCopy({ title: "فحص أطفال" }),
    showOnHome: true,
    homeSort: 2,
    homeImage: "https://example.com/card.jpg",
  },
});
const arPage = arabicSaved[0]!;
assert.equal(arPage.revision, page.revision + 1);
assert.equal(arPage.locales.ar?.complete, true);
assert.equal(arPage.locales.ar?.title, "فحص أطفال");
assert.deepEqual(arPage.locales.ar?.benefits, ["One", "Two", "", "", ""]);
assert.deepEqual(visibleCustomBenefits(arPage.locales.ar?.benefits), ["One", "Two"]);
assert.equal(arPage.locales.he, undefined);

const heEmptyBenefits = persistCustomPages(arabicSaved, {
  customPageOp: {
    op: "update",
    id: arPage.id,
    expectedRevision: arPage.revision,
    locale: "he",
    copy: emptyCustomPageCopy(),
  },
});
assert.deepEqual(heEmptyBenefits[0]?.locales.ar?.benefits, ["One", "Two", "", "", ""]);
assert.deepEqual(heEmptyBenefits[0]?.locales.he?.benefits, ["", "", "", "", ""]);
assert.deepEqual(visibleCustomBenefits(heEmptyBenefits[0]?.locales.he?.benefits), []);
assert.equal(arPage.status, "draft");
assert.equal(arPage.showOnHome, true);

assert.throws(
  () =>
    persistCustomPages(arabicSaved, {
      customPageOp: {
        op: "update",
        id: arPage.id,
        expectedRevision: arPage.revision,
        status: "published",
        locale: "ar",
        copy: emptyCustomPageCopy(),
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_PUBLISH_INCOMPLETE",
);

const published = persistCustomPages(arabicSaved, {
  customPageOp: {
    op: "update",
    id: arPage.id,
    expectedRevision: arPage.revision,
    status: "published",
  },
});
const live = published[0]!;
assert.equal(live.status, "published");
assert.equal(live.locales.ar?.complete, true);

const publicPages = publicCustomPages(published);
assert.equal(publicPages.length, 1);
assert.equal(publicPages[0]?.locales.he, undefined);
assert.equal(publicPages[0]?.locales.en, undefined);
assert.equal(publicPages[0]?.locales.ar?.title, "فحص أطفال");

assert.equal(resolvePublishedCustomPage(published, "kids-exam", "he"), undefined);
assert.equal(resolvePublishedCustomPage(published, "kids-exam", "en"), undefined);
const arResolved = resolvePublishedCustomPage(published, "kids-exam", "ar");
assert.ok(arResolved);
assert.equal(arResolved?.copy.title, "فحص أطفال");
assert.equal(arResolved?.page.locales.he, undefined);
assert.equal(arResolved?.page.locales.en, undefined);
assert.equal(resolvePublishedCustomPage(published, "missing", "ar"), undefined);

const homeAr = homepageCustomCards(published, "ar");
assert.equal(homeAr.length, 1);
assert.equal(homeAr[0]?.homeImage, "https://example.com/card.jpg");
assert.equal(homepageCustomCards(published, "he").length, 0);
assert.equal(homepageCustomCards(published, "en").length, 0);

const hebrewAdded = persistCustomPages(published, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: live.revision,
    locale: "he",
    copy: completeCopy({
      title: "בדיקת ילדים",
      description: "בדיקה מלאה לילדים.",
      bookingButtonText: "קבעו תור",
      benefitsTitle: "למה זה חשוב",
      valuesTitle: "דיוק",
      valuesText: "מדידה זהירה.",
      homeTitle: "בדיקת ילדים",
    }),
  },
});
assert.equal(hebrewAdded[0]?.locales.ar?.title, "فحص أطفال");
assert.equal(hebrewAdded[0]?.locales.he?.title, "בדיקת ילדים");
assert.equal(hebrewAdded[0]?.locales.he?.complete, true);
assert.equal(hebrewAdded[0]?.locales.en, undefined);
assert.ok(resolvePublishedCustomPage(hebrewAdded, "kids-exam", "he"));
assert.equal(homepageCustomCards(hebrewAdded, "he").length, 1);
assert.equal(homepageCustomCards(hebrewAdded, "en").length, 0);

const unpublished = persistCustomPages(hebrewAdded, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: hebrewAdded[0]!.revision,
    status: "draft",
  },
});
assert.equal(unpublished[0]?.status, "draft");
assert.equal(publicCustomPages(unpublished).length, 0);
assert.equal(resolvePublishedCustomPage(unpublished, "kids-exam", "ar"), undefined);
assert.equal(homepageCustomCards(unpublished, "ar").length, 0);

assert.equal(created[0]?.showHeroButton, true);
assert.equal(
  isCustomPageLocaleComplete(
    created[0]!.sections,
    { ...completeCopy(), bookingButtonText: "" },
    true,
  ),
  false,
);

assert.equal(sanitizeInternalPath("/about"), "/about");
assert.equal(sanitizeInternalPath("/admin"), undefined);
assert.equal(sanitizeInternalPath("/api/settings"), undefined);
assert.equal(sanitizeInternalPath("//evil.example"), undefined);
assert.equal(sanitizeInternalPath("javascript:alert(1)"), undefined);
assert.equal(sanitizeInternalPath("/services/../admin"), undefined);
assert.equal(sanitizeExternalUrl("https://example.com/care"), "https://example.com/care");
assert.equal(sanitizeExternalUrl("javascript:alert(1)"), undefined);
assert.equal(sanitizeExternalUrl("http://example.com"), undefined);
assert.equal(sanitizeExternalUrl("https://localhost/x"), undefined);
assert.equal(sanitizeExternalUrl("https://127.0.0.1/x"), undefined);

assert.equal(bookingHrefForPage(live), "/book");
const withBooking = persistCustomPages(unpublished, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: unpublished[0]!.revision,
    bookingType: "eye_exam",
  },
});
assert.equal(bookingHrefForPage(withBooking[0]!), "/book?type=eye_exam");
const invalidBooking = persistCustomPages(withBooking, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: withBooking[0]!.revision,
    bookingType: "not a key!!",
  },
});
assert.equal(invalidBooking[0]?.bookingType, "eye_exam");
const clearedBooking = persistCustomPages(invalidBooking, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: invalidBooking[0]!.revision,
    bookingType: null,
  },
});
assert.equal(clearedBooking[0]?.bookingType, null);

const hiddenButton = persistCustomPages(clearedBooking, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: clearedBooking[0]!.revision,
    showHeroButton: false,
    sections: created[0]!.sections.filter((section) => section.type !== "bookingCta"),
    locale: "ar",
    copy: completeCopy({ bookingButtonText: "" }),
  },
});
assert.equal(hiddenButton[0]?.showHeroButton, false);
assert.equal(hiddenButton[0]?.locales.ar?.complete, true);
assert.equal(hiddenButton[0]?.locales.ar?.bookingButtonText, "");

const externalOk = persistCustomPages(hiddenButton, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: hiddenButton[0]!.revision,
    showHeroButton: true,
    ctaKind: "external",
    ctaHref: "https://www.oyonoptics.com/care",
    locale: "ar",
    copy: completeCopy({ bookingButtonText: "المزيد" }),
  },
});
assert.equal(externalOk[0]?.ctaKind, "external");
assert.equal(resolveCtaHref(externalOk[0]!), "https://www.oyonoptics.com/care");

assert.throws(
  () =>
    persistCustomPages(externalOk, {
      customPageOp: {
        op: "update",
        id: live.id,
        expectedRevision: externalOk[0]!.revision,
        showHeroButton: true,
        ctaKind: "external",
        ctaHref: "javascript:alert(1)",
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_INVALID_CTA",
);

const internalOk = persistCustomPages(externalOk, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: externalOk[0]!.revision,
    ctaKind: "internal",
    ctaHref: "/about",
  },
});
assert.equal(resolveCtaHref(internalOk[0]!), "/about");

assert.throws(
  () =>
    persistCustomPages(internalOk, {
      customPageOp: {
        op: "update",
        id: live.id,
        expectedRevision: internalOk[0]!.revision,
        showHeroButton: true,
        ctaKind: "internal",
        ctaHref: "/admin",
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_INVALID_CTA",
);

const lenses = persistCustomPages([], {
  customPageOp: {
    op: "create",
    name: "Kids Lenses",
    slug: "kids-lenses",
    template: "contact-lenses",
  },
});
assert.deepEqual(lenses[0]?.sections, []);
assert.equal(lenses[0]?.showHeroButton, true);
const lensesCopy = completeCopy();
assert.equal(
  isCustomPageLocaleComplete(
    [
      { id: "h", type: "heroMedia" },
      { id: "f", type: "featureGrid" },
      { id: "n", type: "notice" },
    ],
    lensesCopy,
    true,
  ),
  true,
);
assert.equal(
  isCustomPageLocaleComplete(
    [
      { id: "h", type: "heroMedia" },
      { id: "f", type: "featureGrid" },
      { id: "n", type: "notice" },
    ],
    { ...lensesCopy, bookingButtonText: "" },
    true,
  ),
  false,
);
assert.equal(
  isCustomPageLocaleComplete(
    [
      { id: "h", type: "heroMedia" },
      { id: "f", type: "featureGrid" },
      { id: "n", type: "notice" },
    ],
    { ...lensesCopy, bookingButtonText: "" },
    false,
  ),
  true,
);
assert.equal(
  isCustomPageLocaleComplete(
    [
      { id: "h", type: "heroMedia" },
      { id: "f", type: "featureGrid" },
      { id: "n", type: "notice" },
    ],
    {
      ...lensesCopy,
      warningText: "",
    },
    true,
  ),
  false,
);

const reordered = persistCustomPages(lenses, {
  customPageOp: {
    op: "update",
    id: lenses[0]!.id,
    expectedRevision: lenses[0]!.revision,
    sections: [
      { id: "a", type: "bookingCta" },
      { id: "b", type: "featureGrid" },
      { id: "c", type: "gallery" },
      { id: "d", type: "heroMedia" },
    ],
  },
});
assert.deepEqual(
  reordered[0]?.sections.map((section) => section.type),
  ["bookingCta", "featureGrid", "gallery", "heroMedia"],
);

const deleted = persistCustomPages(clearedBooking, {
  customPageOp: {
    op: "delete",
    id: live.id,
    expectedRevision: clearedBooking[0]!.revision,
  },
});
assert.equal(deleted.length, 0);

const stored = persistServicePages(
  {
    eyeExam: { title: "فحص نظر شامل" },
    contactLenses: { title: "العدسات اللاصقة" },
    customPages: created,
  },
  localePatchPayload("he", defaultServicePagesForLocale("he"), {
    includeHomepage: true,
  }),
);
assert.equal(stored.locales?.he?.eyeExam.title.length !== 0, true);
assert.equal(stored.customPages?.[0]?.slug, "kids-exam");
assert.equal(stored.locales?.ar?.eyeExam.title, "فحص نظر شامل");

const afterCreateOp = persistServicePages(stored, {
  customPageOp: {
    op: "create",
    name: "Ortho-K",
    slug: "ortho-k",
    template: "contact-lenses",
  },
});
assert.equal(afterCreateOp.customPages?.length, 2);
assert.equal(afterCreateOp.locales?.he?.eyeExam.title, stored.locales?.he?.eyeExam.title);
assert.equal(afterCreateOp.locales?.ar?.eyeExam.title, "فحص نظر شامل");

const publicDoc = publicServicePages({
  ...afterCreateOp,
  customPages: [
    ...(afterCreateOp.customPages || []),
    {
      id: "csp_draft",
      slug: "secret",
      name: "Secret",
      status: "draft",
      template: "eye-exam",
      showOnHome: true,
      homeSort: 9,
      showHeroButton: false,
      ctaKind: "book",
      sections: created[0]!.sections,
      locales: { ar: completeCopy({ title: "سري" }) },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      revision: 1,
    } satisfies CustomServicePage,
  ],
});
assert.ok(publicDoc?.customPages?.some((item) => item.slug === "secret"));
const publicOnly = publicCustomPages(publicDoc?.customPages);
assert.equal(
  publicOnly.some((item) => item.slug === "secret"),
  false,
);
assert.equal(
  publicCustomPages([
    {
      ...created[0]!,
      status: "published",
      locales: { ar: emptyCustomPageCopy(), he: emptyCustomPageCopy() },
    },
  ]).length,
  0,
);

const normalized = normalizeCustomPages([
  {
    id: "csp_1",
    slug: "ok",
    name: "OK",
    status: "published",
    template: "eye-exam",
    locales: { en: completeCopy({ title: "English only" }) },
    sections: created[0]!.sections,
  },
  { slug: "no-id" },
]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0]?.locales.en?.complete, true);
assert.equal(normalized[0]?.locales.ar, undefined);

const many = Array.from({ length: MAX_CUSTOM_PAGES }, (_, index) => ({
  id: `csp_${index}`,
  slug: `page-${index}`,
  name: `Page ${index}`,
  status: "draft" as const,
  template: "eye-exam" as const,
  sections: created[0]!.sections,
}));
assert.equal(normalizeCustomPages(many).length, MAX_CUSTOM_PAGES);
assert.throws(
  () =>
    persistCustomPages(normalizeCustomPages(many), {
      customPageOp: {
        op: "create",
        name: "Overflow",
        slug: "overflow",
        template: "eye-exam",
      },
    }),
  (error: unknown) =>
    error instanceof CustomPageError && error.code === "CUSTOM_PAGE_LIMIT",
);

const withProducts = persistCustomPages(internalOk, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: internalOk[0]!.revision,
    productIds: ["prod_a", "prod_a", " prod_b ", "", "prod_c"],
    sections: [
      ...internalOk[0]!.sections,
      { id: "sec_products", type: "products" },
    ],
  },
});
assert.deepEqual(withProducts[0]?.productIds, ["prod_a", "prod_b", "prod_c"]);
assert.ok(withProducts[0]?.sections.some((section) => section.type === "products"));

const mixedIds = attachProductIds(withProducts[0]?.productIds, ["prod_b", "prod_d"]);
assert.deepEqual(mixedIds, ["prod_a", "prod_b", "prod_c", "prod_d"]);
assert.deepEqual(detachProductId(mixedIds, "prod_b"), ["prod_a", "prod_c", "prod_d"]);
assert.deepEqual(uniqueProductIds(mixedIds), mixedIds);

const overflowIds = uniqueProductIds(
  Array.from({ length: MAX_PAGE_PRODUCTS + 5 }, (_, index) => `prod_${index}`),
);
assert.equal(overflowIds.length, MAX_PAGE_PRODUCTS);

const catalog = [
  { id: "prod_a", status: "active" as const },
  { id: "prod_b", status: "draft" as const },
  { id: "prod_c", status: "out_of_stock" as const },
  { id: "prod_d", status: "archived" as const },
];
assert.deepEqual(
  resolveCustomPageProducts(catalog, ["prod_a", "missing", "prod_b", "prod_c", "prod_d"]).map(
    (item) => item.id,
  ),
  ["prod_a", "prod_c"],
);
assert.deepEqual(
  resolveCustomPageProducts(catalog, ["prod_a", "prod_b"], { includeDrafts: true }).map(
    (item) => item.id,
  ),
  ["prod_a", "prod_b"],
);

const removedFromPage = persistCustomPages(withProducts, {
  customPageOp: {
    op: "update",
    id: live.id,
    expectedRevision: withProducts[0]!.revision,
    productIds: ["prod_a"],
  },
});
assert.deepEqual(removedFromPage[0]?.productIds, ["prod_a"]);

assert.equal(validateImageFile({ name: "a.jpg", size: 12, type: "image/jpeg" }), null);
assert.equal(validateImageFile({ name: "a.gif", size: 12, type: "image/gif" }), "type");
assert.equal(validateImageFile({ name: "a.png", size: 0, type: "image/png" }), "empty");
assert.equal(
  fileFingerprint({ name: "a.jpg", size: 12, lastModified: 1, type: "image/jpeg" }),
  "a.jpg:12:1:image/jpeg",
);
assert.deepEqual(
  galleryWithoutDuplicate(
    [{ url: "https://cdn.example/a.jpg" }],
    { url: "https://cdn.example/a.jpg" },
    6,
  ),
  [{ url: "https://cdn.example/a.jpg" }],
);

const listed = listCustomPagesForEditor([
  { ...created[0]!, id: "csp_old", name: "Old Care", slug: "old-care", createdAt: "2026-01-01T00:00:00.000Z" },
  { ...created[0]!, id: "csp_new", name: "New Care", slug: "new-care", createdAt: "2026-10-01T00:00:00.000Z" },
]);
assert.deepEqual(listed.map((page) => page.id), ["csp_new", "csp_old"]);
assert.deepEqual(
  listCustomPagesForEditor(listed, "new").map((page) => page.slug),
  ["new-care"],
);
const afterSecond = persistCustomPages(created, {
  customPageOp: {
    op: "create",
    name: "Night Clinic",
    slug: "night-clinic",
    template: "contact-lenses",
  },
});
assert.equal(afterSecond.length, 2);
assert.ok(listCustomPagesForEditor(afterSecond).some((page) => page.slug === "night-clinic"));

assert.ok(!ADDABLE_CUSTOM_SECTION_TYPES.includes("gallery" as never));
assert.ok(ADDABLE_CUSTOM_SECTION_TYPES.includes("heroMedia"));
const legacyPage = normalizeCustomServicePage({
  id: "csp_legacy",
  slug: "legacy-page",
  name: "Legacy",
  template: "eye-exam",
});
assert.deepEqual(
  legacyPage?.sections.map((section) => section.type),
  ["heroMedia", "featureGrid", "benefitsList", "valuesStrip"],
);
assert.equal(
  isCustomPageLocaleComplete(
    [{ id: "n", type: "notice", hidden: true }],
    { ...lensesCopy, warningText: "" },
    false,
  ),
  true,
);
assert.deepEqual(
  visibleCustomSections([{ id: "g", type: "gallery", hidden: true }]),
  [],
);
const withVariants = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: created[0]!.id,
    expectedRevision: created[0]!.revision,
    heroMedia: {
      kind: "image",
      url: "https://cdn.example/original.jpg",
      desktopUrl: "https://cdn.example/desktop.webp",
      mobileUrl: "https://cdn.example/mobile.webp",
      desktopFocal: { x: 0.4, y: 0.3, zoom: 1.1 },
      fit: "contain",
    },
    homeMedia: {
      kind: "image",
      url: "https://cdn.example/card.jpg",
      mobileUrl: "https://cdn.example/card-m.webp",
    },
  },
});
assert.equal(withVariants[0]?.heroMedia?.desktopUrl, "https://cdn.example/desktop.webp");
assert.equal(withVariants[0]?.heroMedia?.fit, "contain");
assert.equal(withVariants[0]?.heroMedia?.desktopFocal?.zoom, 1.1);

const zoomOutSaved = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: created[0]!.id,
    expectedRevision: created[0]!.revision,
    heroMedia: {
      kind: "image",
      url: "https://cdn.example/original.jpg",
      desktopFocal: { x: 0.5, y: 0.38, zoom: 0.7 },
      mobileFocal: { x: 0.45, y: 0.4, zoom: 0.8 },
    },
  },
});
assert.equal(zoomOutSaved[0]?.heroMedia?.desktopFocal?.zoom, 0.7);
assert.equal(zoomOutSaved[0]?.heroMedia?.mobileFocal?.zoom, 0.8);
assert.equal(withVariants[0]?.homeImage, "https://cdn.example/card.jpg");
assert.deepEqual(withVariants[0]?.gallery || [], created[0]?.gallery || []);

const renamed = persistCustomPages(created, {
  customPageOp: {
    op: "update",
    id: created[0]!.id,
    expectedRevision: created[0]!.revision,
    status: "published",
    locale: "ar",
    copy: completeCopy(),
    sections: [
      {
        id: "sec_hero",
        type: "heroMedia",
        adminLabel: "الهيرو التنظيمي",
      },
    ],
  },
});
assert.equal(renamed[0]?.sections[0]?.adminLabel, "الهيرو التنظيمي");
assert.equal(renamed[0]?.locales.ar?.title, completeCopy().title);
const publicRenamed = publicCustomPages(renamed);
assert.equal(publicRenamed[0]?.sections[0]?.id, "sec_hero");
assert.equal(publicRenamed[0]?.sections[0]?.adminLabel, undefined);
const resolved = resolvePublishedCustomPage(renamed, created[0]!.slug, "ar");
assert.equal(resolved?.page.sections[0]?.adminLabel, undefined);
assert.equal(resolved?.copy.title, completeCopy().title);

assert.equal(sanitizeArticleHeading("  ماذا يشمل  \n فحص النظر  "), "ماذا يشمل فحص النظر");
assert.equal(sanitizeArticleHeading("<b>فحص</b>"), "فحص");
assert.equal(sanitizeArticleBody("سطر أول\n\nسطر ثانٍ<script>x</script>").includes("<"), false);
assert.equal(sanitizeArticleBody("   \n  "), "");
assert.equal(resolveSectionArticle({ id: "s", type: "featureGrid" }, "ar"), null);

const articlePage = persistCustomPages(renamed, {
  customPageOp: {
    op: "update",
    id: renamed[0]!.id,
    expectedRevision: renamed[0]!.revision,
    sections: [
      {
        id: "sec_features",
        type: "featureGrid",
        article: {
          align: "center",
          position: "before",
          locales: {
            ar: { heading: "ماذا يشمل فحص النظر لدينا", body: "وصف عربي" },
            he: { heading: "כותרת", body: "" },
            en: { heading: "", body: "  " },
          },
        },
      },
      {
        id: "sec_products",
        type: "products",
        article: {
          align: "left",
          position: "after",
          locales: {
            ar: { heading: "", body: "نص المنتجات فقط" },
          },
        },
      },
    ],
  },
});
const featuresSec = articlePage[0]?.sections.find((item) => item.id === "sec_features");
const productsSec = articlePage[0]?.sections.find((item) => item.id === "sec_products");
assert.equal(featuresSec?.article?.align, "center");
assert.equal(featuresSec?.article?.position, "before");
assert.equal(featuresSec?.article?.locales?.ar?.heading, "ماذا يشمل فحص النظر لدينا");
assert.equal(featuresSec?.article?.locales?.he?.heading, "כותרת");
assert.equal(featuresSec?.article?.locales?.en, undefined);
assert.equal(resolveSectionArticle(featuresSec, "en"), null);
assert.equal(resolveSectionArticle(featuresSec, "he")?.body, "");
assert.equal(resolveSectionArticle(featuresSec, "he")?.heading, "כותרת");
assert.equal(productsSec?.article?.align, "left");
assert.equal(productsSec?.article?.position, "after");
assert.equal(resolveSectionArticle(productsSec, "ar")?.heading, "");
assert.equal(resolveSectionArticle(productsSec, "ar")?.body, "نص المنتجات فقط");

const emptyArticle = persistCustomPages(articlePage, {
  customPageOp: {
    op: "update",
    id: articlePage[0]!.id,
    expectedRevision: articlePage[0]!.revision,
    sections: [
      {
        id: "sec_features",
        type: "featureGrid",
        article: {
          align: "right",
          position: "after",
          locales: { ar: { heading: "   ", body: "" } },
        },
      },
    ],
  },
});
assert.equal(emptyArticle[0]?.sections[0]?.article, undefined);

const articleReordered = persistCustomPages(articlePage, {
  customPageOp: {
    op: "update",
    id: articlePage[0]!.id,
    expectedRevision: articlePage[0]!.revision,
    sections: [productsSec!, featuresSec!],
  },
});
assert.equal(articleReordered[0]?.sections[0]?.id, "sec_products");
assert.equal(articleReordered[0]?.sections[0]?.article?.locales?.ar?.body, "نص المنتجات فقط");
assert.equal(articleReordered[0]?.sections[1]?.article?.locales?.ar?.heading, "ماذا يشمل فحص النظر لدينا");

const publicArticle = publicCustomPages(articlePage);
assert.equal(publicArticle[0]?.sections.find((item) => item.id === "sec_features")?.article?.locales?.ar?.heading, "ماذا يشمل فحص النظر لدينا");
assert.equal(publicArticle[0]?.sections.find((item) => item.id === "sec_features")?.adminLabel, undefined);

const removed = persistCustomPages(articlePage, {
  customPageOp: {
    op: "update",
    id: articlePage[0]!.id,
    expectedRevision: articlePage[0]!.revision,
    sections: [productsSec!],
  },
});
assert.equal(removed[0]?.sections.some((item) => item.id === "sec_features"), false);
assert.equal(removed[0]?.sections[0]?.article?.locales?.ar?.body, "نص المنتجات فقط");

const legacyStill = normalizeCustomServicePage({
  id: "csp_plain",
  slug: "plain-page",
  name: "Plain",
  template: "eye-exam",
  sections: [{ id: "sec_old", type: "featureGrid" }],
});
assert.equal(legacyStill?.sections[0]?.article, undefined);

console.log("custom service pages tests passed");
