import { isBookingServiceKey } from "@/lib/booking-services";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  pickServiceFeatureIcon,
} from "@/lib/service-page-icons";
import type {
  CustomPageCopy,
  CustomPageCtaKind,
  CustomPageMediaRef,
  CustomPageOp,
  CustomPageSection,
  CustomPageTemplate,
  CustomSectionType,
  CustomServicePage,
  Product,
  ServicePageFeature,
  ServicePagesLocale,
  ServicePagesSettings,
} from "@/lib/types";
import { CUSTOM_CTA_KINDS, CUSTOM_SECTION_TYPES } from "@/lib/types";

function isServicePagesLocale(
  value: string | null | undefined,
): value is ServicePagesLocale {
  return value === "ar" || value === "he" || value === "en";
}

export { CUSTOM_CTA_KINDS, CUSTOM_SECTION_TYPES };

export const MAX_CUSTOM_PAGES = 30;
export const MAX_CUSTOM_SECTIONS = 12;
export const MAX_GALLERY_ITEMS = 6;
export const MAX_PAGE_PRODUCTS = 16;
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
      ? ["heroMedia", "featureGrid", "notice"]
      : ["heroMedia", "featureGrid", "benefitsList", "valuesStrip"];
  return types.map((type) => createCustomSection(type));
}

export const PUBLIC_INTERNAL_PATHS = [
  "/",
  "/book",
  "/shop",
  "/frames",
  "/sunglasses",
  "/contact-lenses",
  "/eye-exams",
  "/about",
  "/gallery",
  "/promotions",
  "/contact",
  "/privacy",
] as const;

const PUBLIC_INTERNAL_PREFIXES = ["/services/", "/product/"] as const;
const BLOCKED_INTERNAL_PREFIXES = [
  "/admin",
  "/api",
  "/login",
  "/appointments",
] as const;

export function parseCtaKind(value: unknown): CustomPageCtaKind | undefined {
  return typeof value === "string" &&
    (CUSTOM_CTA_KINDS as readonly string[]).includes(value)
    ? (value as CustomPageCtaKind)
    : undefined;
}

function isBlockedHostname(host: string): boolean {
  const hostname = host.trim().toLowerCase().replace(/\.+$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") {
    return true;
  }
  if (/^(10\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (!hostname.includes(".")) return true;
  return false;
}

export function sanitizeInternalPath(value: unknown): string | undefined {
  const raw = cleanText(value);
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return undefined;
  }
  if (raw.includes("://") || /[\u0000-\u001F]/.test(raw)) return undefined;
  let decoded = raw;
  try {
    decoded = decodeURI(raw);
  } catch {
    return undefined;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(decoded, "https://oyon.invalid");
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  if (url.hostname !== "oyon.invalid") return undefined;
  const path = url.pathname;
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  if (
    BLOCKED_INTERNAL_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  ) {
    return undefined;
  }
  const allowed =
    (PUBLIC_INTERNAL_PATHS as readonly string[]).includes(path) ||
    PUBLIC_INTERNAL_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (!allowed) return undefined;
  return `${path}${url.search}${url.hash}`;
}

export function sanitizeExternalUrl(value: unknown): string | undefined {
  const raw = cleanText(value);
  if (!raw || raw.length > 500) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  if (url.username || url.password) return undefined;
  if (isBlockedHostname(url.hostname)) return undefined;
  return url.toString();
}

export function pageHasVisibleButton(
  sections: CustomPageSection[],
  showHeroButton: boolean,
): boolean {
  return showHeroButton || hasSection(sections, "bookingCta");
}

export function resolveCtaHref(page: Pick<
  CustomServicePage,
  "ctaKind" | "bookingType" | "ctaHref"
>): string | null {
  const kind =
    page.ctaKind || (page.bookingType ? "booking" : "book");
  if (kind === "booking") {
    const type = page.bookingType?.trim();
    if (type && isBookingServiceKey(type)) {
      return `/book?type=${encodeURIComponent(type)}`;
    }
    return "/book";
  }
  if (kind === "book") return "/book";
  if (kind === "internal") return sanitizeInternalPath(page.ctaHref) || null;
  if (kind === "external") return sanitizeExternalUrl(page.ctaHref) || null;
  return "/book";
}

export function isExternalCta(
  page: Pick<CustomServicePage, "ctaKind">,
): boolean {
  return page.ctaKind === "external";
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
  showHeroButton = false,
): CustomPageLocaleIssue[] {
  if (!copy) return ["title", "description"];
  const issues: CustomPageLocaleIssue[] = [];
  if (!copy.title) issues.push("title");
  if (!copy.description) issues.push("description");
  if (
    pageHasVisibleButton(sections, showHeroButton) &&
    !copy.bookingButtonText
  ) {
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
  showHeroButton = false,
): boolean {
  return customPageLocaleIssues(sections, copy, showHeroButton).length === 0;
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

export function uniqueProductIds(
  saved: unknown,
  max = MAX_PAGE_PRODUCTS,
): string[] {
  const list = Array.isArray(saved) ? saved : [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const id = cleanText(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

export function attachProductIds(
  current: unknown,
  incoming: unknown,
): string[] {
  return uniqueProductIds([
    ...uniqueProductIds(current),
    ...(Array.isArray(incoming) ? incoming : [incoming]),
  ]);
}

export function detachProductId(current: unknown, id: string): string[] {
  const remove = cleanText(id);
  return uniqueProductIds(current).filter((item) => item !== remove);
}

export function resolveCustomPageProducts<T extends Pick<Product, "id" | "status">>(
  catalog: T[] | undefined,
  ids: unknown,
  options?: { includeDrafts?: boolean },
): T[] {
  const wanted = uniqueProductIds(ids);
  if (!wanted.length || !catalog?.length) return [];
  const byId = new Map(catalog.map((product) => [product.id, product]));
  const includeDrafts = Boolean(options?.includeDrafts);
  const resolved: T[] = [];
  for (const id of wanted) {
    const product = byId.get(id);
    if (!product) continue;
    if (
      !includeDrafts &&
      product.status !== "active" &&
      product.status !== "out_of_stock"
    ) {
      continue;
    }
    resolved.push(product);
  }
  return resolved;
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
  showHeroButton: boolean,
): CustomServicePage["locales"] {
  const raw = asRecord(saved);
  const locales: CustomServicePage["locales"] = {};
  for (const locale of ["ar", "he", "en"] as const) {
    if (!(locale in raw)) continue;
    const copy = sparseCustomPageCopy(raw[locale]);
    copy.complete = isCustomPageLocaleComplete(sections, copy, showHeroButton);
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
  const bookingType =
    bookingRaw && isBookingServiceKey(bookingRaw) ? bookingRaw : null;
  const showHeroButton = Boolean(raw.showHeroButton);
  const parsedKind = parseCtaKind(raw.ctaKind);
  const ctaKind: CustomPageCtaKind =
    parsedKind || (bookingType ? "booking" : "book");
  const ctaHref =
    ctaKind === "external"
      ? sanitizeExternalUrl(raw.ctaHref)
      : ctaKind === "internal"
        ? sanitizeInternalPath(raw.ctaHref)
        : undefined;
  return {
    id,
    slug,
    name: cleanText(raw.name) || slug,
    status: raw.status === "published" ? "published" : "draft",
    template,
    showOnHome: Boolean(raw.showOnHome),
    homeSort: Number.isFinite(Number(raw.homeSort)) ? Number(raw.homeSort) : 0,
    homeImage: cleanText(raw.homeImage) || undefined,
    showHeroButton,
    ctaKind,
    bookingType,
    ctaHref,
    sections,
    heroMedia: sparseMedia(raw.heroMedia),
    gallery: sparseGallery(raw.gallery),
    productIds: uniqueProductIds(raw.productIds),
    locales: sparseLocales(raw.locales, sections, showHeroButton),
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
  return resolveCtaHref(page) || "/book";
}

function assertSafeCta(page: CustomServicePage): void {
  if (!pageHasVisibleButton(page.sections, page.showHeroButton)) return;
  if (resolveCtaHref(page)) return;
  throw new CustomPageError("CUSTOM_PAGE_INVALID_CTA");
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
  const showHeroButton =
    op.showHeroButton != null ? Boolean(op.showHeroButton) : page.showHeroButton;
  const bookingType =
    op.bookingType === null
      ? null
      : op.bookingType != null
        ? cleanText(op.bookingType) && isBookingServiceKey(op.bookingType)
          ? op.bookingType
          : page.bookingType
        : page.bookingType;
  let ctaKind: CustomPageCtaKind = page.ctaKind || "book";
  if (op.ctaKind != null) {
    ctaKind = parseCtaKind(op.ctaKind) || ctaKind;
  } else if (op.bookingType != null && bookingType) {
    ctaKind = "booking";
  } else if (op.bookingType === null && ctaKind === "booking") {
    ctaKind = "book";
  }
  const ctaHrefRaw =
    op.ctaHref === null ? undefined : op.ctaHref != null ? op.ctaHref : page.ctaHref;
  const ctaHref =
    ctaKind === "external"
      ? sanitizeExternalUrl(ctaHrefRaw)
      : ctaKind === "internal"
        ? sanitizeInternalPath(ctaHrefRaw)
        : undefined;
  if (op.status === "published") {
    const locales = { ...page.locales };
    if (op.locale && op.copy) {
      const copy = sparseCustomPageCopy(op.copy);
      copy.complete = isCustomPageLocaleComplete(sections, copy, showHeroButton);
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
    showHeroButton,
    ctaKind,
    bookingType,
    ctaHref,
    sections,
    heroMedia:
      op.heroMedia === null
        ? undefined
        : op.heroMedia != null
          ? sparseMedia(op.heroMedia)
          : page.heroMedia,
    gallery: op.gallery ? sparseGallery(op.gallery) : page.gallery,
    productIds:
      op.productIds != null ? uniqueProductIds(op.productIds) : page.productIds || [],
    locales: { ...page.locales },
    updatedAt: new Date().toISOString(),
    revision: page.revision + 1,
  };
  if (op.locale && op.copy) {
    const copy = sparseCustomPageCopy(op.copy);
    copy.complete = isCustomPageLocaleComplete(
      next.sections,
      copy,
      next.showHeroButton,
    );
    next.locales = { ...next.locales, [op.locale]: copy };
  } else if (op.sections || op.showHeroButton != null) {
    const locales: CustomServicePage["locales"] = {};
    for (const locale of ["ar", "he", "en"] as const) {
      const copy = next.locales[locale];
      if (!copy) continue;
      locales[locale] = {
        ...copy,
        complete: isCustomPageLocaleComplete(
          next.sections,
          copy,
          next.showHeroButton,
        ),
      };
    }
    next.locales = locales;
  }
  if (next.status === "published") {
    const anyComplete = Object.values(next.locales).some((copy) => copy?.complete);
    if (!anyComplete) throw new CustomPageError("CUSTOM_PAGE_PUBLISH_INCOMPLETE");
  }
  assertSafeCta(next);
  if (
    pageHasVisibleButton(next.sections, next.showHeroButton) &&
    (ctaKind === "internal" || ctaKind === "external") &&
    op.ctaHref != null &&
    op.ctaHref !== "" &&
    !next.ctaHref
  ) {
    throw new CustomPageError("CUSTOM_PAGE_INVALID_CTA");
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
      showHeroButton: true,
      ctaKind: "book",
      bookingType: null,
      sections: defaultCustomSections(template),
      gallery: [],
      productIds: [],
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
