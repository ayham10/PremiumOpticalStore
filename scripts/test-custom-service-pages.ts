import assert from "node:assert/strict";
import {
  bookingHrefForPage,
  emptyCustomPageCopy,
  homepageCustomCards,
  isCustomPageLocaleComplete,
  MAX_CUSTOM_PAGES,
  normalizeCustomPages,
  persistCustomPages,
  publicCustomPages,
  RESERVED_SERVICE_SLUGS,
  resolveCtaHref,
  resolvePublishedCustomPage,
  sanitizeExternalUrl,
  sanitizeInternalPath,
  CustomPageConflictError,
  CustomPageError,
} from "../lib/custom-service-pages";
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
const created = createdPages();
assert.equal(created.length, 1);
assert.equal(created[0]?.slug, "kids-exam");
assert.equal(created[0]?.status, "draft");
assert.equal(created[0]?.template, "eye-exam");
assert.equal(created[0]?.showHeroButton, true);
assert.equal(created[0]?.ctaKind, "book");
assert.deepEqual(
  created[0]?.sections.map((section) => section.type),
  ["heroMedia", "featureGrid", "benefitsList", "valuesStrip"],
);
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
assert.equal(arPage.locales.he, undefined);
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
assert.deepEqual(
  lenses[0]?.sections.map((section) => section.type),
  ["heroMedia", "featureGrid", "notice"],
);
assert.equal(lenses[0]?.showHeroButton, true);
const lensesCopy = completeCopy();
assert.equal(
  isCustomPageLocaleComplete(lenses[0]!.sections, lensesCopy, true),
  true,
);
assert.equal(
  isCustomPageLocaleComplete(
    lenses[0]!.sections,
    { ...lensesCopy, bookingButtonText: "" },
    true,
  ),
  false,
);
assert.equal(
  isCustomPageLocaleComplete(
    lenses[0]!.sections,
    { ...lensesCopy, bookingButtonText: "" },
    false,
  ),
  true,
);
assert.equal(
  isCustomPageLocaleComplete(lenses[0]!.sections, {
    ...lensesCopy,
    warningText: "",
  }, true),
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

console.log("custom service pages tests passed");
