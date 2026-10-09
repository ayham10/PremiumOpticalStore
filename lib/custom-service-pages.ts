import { isBookingServiceKey } from "@/lib/booking-services";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  pickServiceFeatureIcon,
} from "@/lib/service-page-icons";
import type {
  CustomPageCopy,
  CustomPageMediaRef,
  CustomPageOp,
  CustomPageSection,
  CustomPageTemplate,
  CustomSectionType,
  CustomServicePage,
  ServicePageFeature,
  ServicePagesLocale,
  ServicePagesSettings,
} from "@/lib/types";
import { CUSTOM_SECTION_TYPES } from "@/lib/types";

function isServicePagesLocale(
  value: string | null | undefined,
): value is ServicePagesLocale {
  return value === "ar" || value === "he" || value === "en";
}

export { CUSTOM_SECTION_TYPES };

export const MAX_CUSTOM_PAGES = 30;
export const MAX_CUSTOM_SECTIONS = 12;
export const MAX_GALLERY_ITEMS = 6;
export const CUSTOM_FEATURE_COUNT = 4;
export const CUSTOM_BENEFIT_COUNT = 5;

export const RESERVED_SERVICE_SLUGS = new Set([
  "eye-exams",
  "contact-lenses",
  "frames",
  "sunglasses",
  "book",
  "shop",
  "about",
  "gallery",
  "promotions",
  "contact",
  "privacy",
  "admin",
  "appointments",
  "product",
  "api",
  "services",
  "login",
  "home",
  "index",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CustomPageConflictError extends Error {
  pageId: string;
  constructor(pageId: string) {
    super("CUSTOM_PAGE_CONFLICT");
    this.name = "CustomPageConflictError";
    this.pageId = pageId;
  }
}

export class CustomPageError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "CustomPageError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function makeId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeCustomSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function assertValidCustomSlug(slug: string): void {
  if (!slug || slug.length < 2 || !SLUG_RE.test(slug)) {
    throw new CustomPageError("CUSTOM_PAGE_INVALID_SLUG");
  }
  if (RESERVED_SERVICE_SLUGS.has(slug)) {
    throw new CustomPageError("CUSTOM_PAGE_RESERVED");
  }
}

export function createCustomSection(type: CustomSectionType): CustomPageSection {
  return { id: makeId("sec"), type };
}

export function defaultCustomSections(
  template: CustomPageTemplate,
): CustomPageSection[] {
  const types: CustomSectionType[] =
    template === "contact-lenses"
      ? ["heroMedia", "featureGrid", "notice", "bookingCta"]
      : ["heroMedia", "featureGrid", "benefitsList", "valuesStrip", "bookingCta"];
  return types.map((type) => createCustomSection(type));
}

export function emptyCustomPageCopy(): CustomPageCopy {
  return {
    complete: false,
    eyebrow: "",
    title: "",
    description: "",
    bookingButtonText: "",
    features: Array.from({ length: CUSTOM_FEATURE_COUNT }, (_, index) => ({
      title: "",
      description: "",
      icon:
        EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ||
        CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ||
        "eye",
    })),
    benefitsTitle: "",
    benefits: Array.from({ length: CUSTOM_BENEFIT_COUNT }, () => ""),
    warningTitle: "",
    warningText: "",
    valuesTitle: "",
    valuesText: "",
    privacyText: "",
    homeTitle: "",
    homeSubtitle: "",
  };
}

function sparseFeatureList(saved: unknown): ServicePageFeature[] {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: CUSTOM_FEATURE_COUNT }, (_, index) => {
    const row = asRecord(list[index]);
    const fallback =
      EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ||
      CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ||
      "eye";
    return {
      title: cleanText(row.title),
      description: cleanText(row.description),
      icon: pickServiceFeatureIcon(cleanText(row.icon) || undefined, fallback),
    };
  });
}

function sparseBenefits(saved: unknown): string[] {
  const list = Array.isArray(saved) ? saved : [];
  return Array.from({ length: CUSTOM_BENEFIT_COUNT }, (_, index) =>
    cleanText(list[index]),
  );
}

export function sparseCustomPageCopy(saved: unknown): CustomPageCopy {
  const raw = asRecord(saved);
  return {
    complete: false,
    eyebrow: cleanText(raw.eyebrow),
    title: cleanText(raw.title),
    description: cleanText(raw.description),
    bookingButtonText: cleanText(raw.bookingButtonText),
    features: sparseFeatureList(raw.features),
    benefitsTitle: cleanText(raw.benefitsTitle),
    benefits: sparseBenefits(raw.benefits),
    warningTitle: cleanText(raw.warningTitle),
    warningText: cleanText(raw.warningText),
    valuesTitle: cleanText(raw.valuesTitle),
    valuesText: cleanText(raw.valuesText),
    privacyText: cleanText(raw.privacyText),
    homeTitle: cleanText(raw.homeTitle),
    homeSubtitle: cleanText(raw.homeSubtitle),
  };
}

function hasSection(sections: CustomPageSection[], type: CustomSectionType): boolean {
  return sections.some((section) => section.type === type);
}

export type CustomPageLocaleIssue =
  | "title"
  | "description"
  | "bookingButtonText"
  | "features"
  | "benefits"
  | "warningText"
  | "values";

export function customPageLocaleIssues(
  sections: CustomPageSection[],
  copy: CustomPageCopy | undefined,
): CustomPageLocaleIssue[] {
  if (!copy) return ["title", "description"];
  const issues: CustomPageLocaleIssue[] = [];
  if (!copy.title) issues.push("title");
  if (!copy.description) issues.push("description");
  if (hasSection(sections, "bookingCta") && !copy.bookingButtonText) {
    issues.push("bookingButtonText");
  }
  if (hasSection(sections, "featureGrid")) {
    const filled = copy.features.filter(
      (feature) => feature.title && feature.description,
    );
    if (filled.length < 2) issues.push("features");
  }
  if (hasSection(sections, "benefitsList")) {
    const items = copy.benefits.filter(Boolean);
    if (!copy.benefitsTitle || items.length < 2) issues.push("benefits");
  }
  if (hasSection(sections, "notice") && !copy.warningText) {
    issues.push("warningText");
  }
  if (hasSection(sections, "valuesStrip")) {
    if (!copy.valuesTitle || !copy.valuesText) issues.push("values");
  }
  return issues;
}

export function isCustomPageLocaleComplete(
  sections: CustomPageSection[],
  copy: CustomPageCopy | undefined,
): boolean {
  return customPageLocaleIssues(sections, copy).length === 0;
}

export function copyForCustomPageEditor(
  page: CustomServicePage,
  locale: ServicePagesLocale,
): CustomPageCopy {
  const saved = page.locales[locale];
  return saved ? structuredClone(saved) : emptyCustomPageCopy();
}

function sparseMedia(saved: unknown): CustomPageMediaRef | undefined {
  const raw = asRecord(saved);
  const url = cleanText(raw.url);
  if (!url) return undefined;
  const kind = raw.kind === "video" ? "video" : "image";
  const mediaId = cleanText(raw.mediaId) || undefined;
  return { kind, url, mediaId };
}

function sparseGallery(saved: unknown): CustomPageMediaRef[] {
  const list = Array.isArray(saved) ? saved : [];
  return list
    .map((item) => sparseMedia(item))
    .filter((item): item is CustomPageMediaRef => Boolean(item))
    .slice(0, MAX_GALLERY_ITEMS);
}

function sparseSections(saved: unknown, template: CustomPageTemplate): CustomPageSection[] {
  const list = Array.isArray(saved) ? saved : [];
  const next: CustomPageSection[] = [];
  for (const item of list) {
    const raw = asRecord(item);
    const type = raw.type;
    if (
      typeof type !== "string" ||
      !(CUSTOM_SECTION_TYPES as readonly string[]).includes(type)
    ) {
      continue;
    }
    next.push({
      id: cleanText(raw.id) || makeId("sec"),
      type: type as CustomSectionType,
    });
    if (next.length >= MAX_CUSTOM_SECTIONS) break;
  }
  return next.length ? next : defaultCustomSections(template);
}

function sparseLocales(
  saved: unknown,
  sections: CustomPageSection[],
): CustomServicePage["locales"] {
  const raw = asRecord(saved);
  const locales: CustomServicePage["locales"] = {};
  for (const locale of ["ar", "he", "en"] as const) {
    if (!(locale in raw)) continue;
    const copy = sparseCustomPageCopy(raw[locale]);
    copy.complete = isCustomPageLocaleComplete(sections, copy);
    locales[locale] = copy;
  }
  return locales;
}

export function normalizeCustomServicePage(saved: unknown): CustomServicePage | null {
  const raw = asRecord(saved);
  const id = cleanText(raw.id);
  const slug = normalizeCustomSlug(raw.slug);
  const template: CustomPageTemplate =
    raw.template === "contact-lenses" ? "contact-lenses" : "eye-exam";
  if (!id || !slug) return null;
  const sections = sparseSections(raw.sections, template);
  const bookingRaw = cleanText(raw.bookingType);
  return {
    id,
    slug,
    name: cleanText(raw.name) || slug,
    status: raw.status === "published" ? "published" : "draft",
    template,
    showOnHome: Boolean(raw.showOnHome),
    homeSort: Number.isFinite(Number(raw.homeSort)) ? Number(raw.homeSort) : 0,
    homeImage: cleanText(raw.homeImage) || undefined,
    bookingType: bookingRaw && isBookingServiceKey(bookingRaw) ? bookingRaw : null,
    sections,
    heroMedia: sparseMedia(raw.heroMedia),
    gallery: sparseGallery(raw.gallery),
    locales: sparseLocales(raw.locales, sections),
    createdAt: cleanText(raw.createdAt) || new Date().toISOString(),
    updatedAt: cleanText(raw.updatedAt) || new Date().toISOString(),
    revision: Number.isFinite(Number(raw.revision)) ? Number(raw.revision) : 1,
  };
}

export function normalizeCustomPages(saved: unknown): CustomServicePage[] {
  const list = Array.isArray(saved) ? saved : [];
  const pages: CustomServicePage[] = [];
  const ids = new Set<string>();
  for (const item of list) {
    const page = normalizeCustomServicePage(item);
    if (!page || ids.has(page.id)) continue;
    ids.add(page.id);
    pages.push(page);
    if (pages.length >= MAX_CUSTOM_PAGES) break;
  }
  return pages;
}

function publicLocales(
  page: CustomServicePage,
): CustomServicePage["locales"] {
  const locales: CustomServicePage["locales"] = {};
  for (const locale of ["ar", "he", "en"] as const) {
    const copy = page.locales[locale];
    if (copy?.complete) locales[locale] = copy;
  }
  return locales;
}

export function publicCustomPages(saved: unknown): CustomServicePage[] {
  return normalizeCustomPages(saved)
    .filter((page) => page.status === "published")
    .map((page) => ({
      ...page,
      locales: publicLocales(page),
    }))
    .filter((page) => Object.keys(page.locales).length > 0);
}

export function customPageHasCompleteLocale(
  page: CustomServicePage | undefined,
  locale: Locale | ServicePagesLocale,
): boolean {
  if (!page) return false;
  const key: ServicePagesLocale = isServicePagesLocale(locale) ? locale : "ar";
  return Boolean(page.locales[key]?.complete);
}

export function resolvePublishedCustomPage(
  pages: CustomServicePage[] | undefined,
  slug: string,
  locale: Locale | ServicePagesLocale,
): { page: CustomServicePage; copy: CustomPageCopy } | undefined {
  const key: ServicePagesLocale =
    isLocale(locale) && isServicePagesLocale(locale) ? locale : "ar";
  const page = (pages || []).find(
    (item) => item.slug === slug && item.status === "published",
  );
  const copy = page?.locales[key];
  if (!page || !copy?.complete) return undefined;
  return {
    page: {
      ...page,
      locales: { [key]: copy },
    },
    copy,
  };
}

export function homepageCustomCards(
  pages: CustomServicePage[] | undefined,
  locale: Locale | ServicePagesLocale,
): CustomServicePage[] {
  const key: ServicePagesLocale =
    isLocale(locale) && isServicePagesLocale(locale) ? locale : "ar";
  return (pages || [])
    .filter(
      (page) =>
        page.status === "published" &&
        page.showOnHome &&
        page.locales[key]?.complete,
    )
    .sort((a, b) => a.homeSort - b.homeSort || a.name.localeCompare(b.name));
}

export function bookingHrefForPage(page: CustomServicePage): string {
  const type = page.bookingType?.trim();
  if (type && isBookingServiceKey(type)) return `/book?type=${encodeURIComponent(type)}`;
  return "/book";
}

function requireRevision(page: CustomServicePage, expected: unknown): void {
  if (Number(expected) !== page.revision) {
    throw new CustomPageConflictError(page.id);
  }
}

function applyUpdate(
  page: CustomServicePage,
  op: Extract<CustomPageOp, { op: "update" }>,
  siblings: CustomServicePage[],
): CustomServicePage {
  requireRevision(page, op.expectedRevision);
  let slug = page.slug;
  if (op.slug != null) {
    slug = normalizeCustomSlug(op.slug);
    assertValidCustomSlug(slug);
    if (siblings.some((item) => item.id !== page.id && item.slug === slug)) {
      throw new CustomPageError("CUSTOM_PAGE_SLUG_TAKEN");
    }
  }
  const sections = op.sections
    ? sparseSections(op.sections, page.template)
    : page.sections;
  if (op.status === "published") {
    const locales = { ...page.locales };
    if (op.locale && op.copy) {
      const copy = sparseCustomPageCopy(op.copy);
      copy.complete = isCustomPageLocaleComplete(sections, copy);
      locales[op.locale] = copy;
    }
    const anyComplete = Object.values(locales).some((copy) => copy?.complete);
    if (!anyComplete) throw new CustomPageError("CUSTOM_PAGE_PUBLISH_INCOMPLETE");
  }
  const next: CustomServicePage = {
    ...page,
    name: op.name != null ? cleanText(op.name) || page.name : page.name,
    slug,
    status: op.status === "published" || op.status === "draft" ? op.status : page.status,
    showOnHome: op.showOnHome != null ? Boolean(op.showOnHome) : page.showOnHome,
    homeSort: op.homeSort != null ? Number(op.homeSort) || 0 : page.homeSort,
    homeImage:
      op.homeImage === null
        ? undefined
        : op.homeImage != null
          ? cleanText(op.homeImage) || undefined
          : page.homeImage,
    bookingType:
      op.bookingType === null
        ? null
        : op.bookingType != null
          ? cleanText(op.bookingType) && isBookingServiceKey(op.bookingType)
            ? op.bookingType
            : page.bookingType
          : page.bookingType,
    sections,
    heroMedia:
      op.heroMedia === null
        ? undefined
        : op.heroMedia != null
          ? sparseMedia(op.heroMedia)
          : page.heroMedia,
    gallery: op.gallery ? sparseGallery(op.gallery) : page.gallery,
    locales: { ...page.locales },
    updatedAt: new Date().toISOString(),
    revision: page.revision + 1,
  };
  if (op.locale && op.copy) {
    const copy = sparseCustomPageCopy(op.copy);
    copy.complete = isCustomPageLocaleComplete(next.sections, copy);
    next.locales = { ...next.locales, [op.locale]: copy };
  } else if (op.sections) {
    const locales: CustomServicePage["locales"] = {};
    for (const locale of ["ar", "he", "en"] as const) {
      const copy = next.locales[locale];
      if (!copy) continue;
      locales[locale] = {
        ...copy,
        complete: isCustomPageLocaleComplete(next.sections, copy),
      };
    }
    next.locales = locales;
  }
  if (next.status === "published") {
    const anyComplete = Object.values(next.locales).some((copy) => copy?.complete);
    if (!anyComplete) throw new CustomPageError("CUSTOM_PAGE_PUBLISH_INCOMPLETE");
  }
  return next;
}

export function persistCustomPages(
  stored: unknown,
  patch: unknown,
): CustomServicePage[] {
  const current = normalizeCustomPages(stored);
  const patchRaw = asRecord(patch);
  const op = patchRaw.customPageOp as CustomPageOp | undefined;
  if (!op || typeof op !== "object") return current;

  if (op.op === "create") {
    if (current.length >= MAX_CUSTOM_PAGES) {
      throw new CustomPageError("CUSTOM_PAGE_LIMIT");
    }
    const slug = normalizeCustomSlug(op.slug);
    assertValidCustomSlug(slug);
    if (current.some((page) => page.slug === slug)) {
      throw new CustomPageError("CUSTOM_PAGE_SLUG_TAKEN");
    }
    const template: CustomPageTemplate =
      op.template === "contact-lenses" ? "contact-lenses" : "eye-exam";
    const now = new Date().toISOString();
    const page: CustomServicePage = {
      id: makeId("csp"),
      slug,
      name: cleanText(op.name) || slug,
      status: "draft",
      template,
      showOnHome: false,
      homeSort: current.length,
      bookingType: null,
      sections: defaultCustomSections(template),
      gallery: [],
      locales: {},
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    return [...current, page];
  }

  if (op.op === "delete") {
    const page = current.find((item) => item.id === op.id);
    if (!page) throw new CustomPageError("CUSTOM_PAGE_NOT_FOUND");
    requireRevision(page, op.expectedRevision);
    return current.filter((item) => item.id !== op.id);
  }

  if (op.op === "update") {
    const index = current.findIndex((item) => item.id === op.id);
    if (index < 0) throw new CustomPageError("CUSTOM_PAGE_NOT_FOUND");
    const next = [...current];
    next[index] = applyUpdate(current[index]!, op, current);
    return next;
  }

  return current;
}

export function customPagesFromSettings(
  settings: ServicePagesSettings | undefined,
): CustomServicePage[] {
  return normalizeCustomPages(settings?.customPages);
}
