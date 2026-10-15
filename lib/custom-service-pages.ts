import { isBookingServiceKey } from "@/lib/booking-services";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  pickServiceFeatureIcon,
} from "@/lib/service-page-icons";
import type {
  CustomArticleAlign,
  CustomArticlePosition,
  CustomButtonStyle,
  CustomPageCopy,
  CustomPageCtaKind,
  CustomPageLayout,
  CustomPageMediaRef,
  CustomPageOp,
  CustomPageSection,
  CustomPageTemplate,
  CustomSectionArticle,
  CustomSectionArticleCopy,
  CustomSectionButton,
  CustomSectionButtonCopy,
  CustomSectionType,
  CustomServicePage,
  Product,
  ServicePageFeature,
  ServicePagesLocale,
  ServicePagesSettings,
} from "@/lib/types";
import {
  ADDABLE_CUSTOM_SECTION_TYPES,
  CUSTOM_ARTICLE_ALIGNS,
  CUSTOM_ARTICLE_POSITIONS,
  CUSTOM_BUTTON_SECTION_TYPES,
  CUSTOM_BUTTON_STYLES,
  CUSTOM_CTA_KINDS,
  CUSTOM_SECTION_TYPES,
} from "@/lib/types";

function isServicePagesLocale(
  value: string | null | undefined,
): value is ServicePagesLocale {
  return value === "ar" || value === "he" || value === "en";
}

export {
  ADDABLE_CUSTOM_SECTION_TYPES,
  CUSTOM_ARTICLE_ALIGNS,
  CUSTOM_ARTICLE_POSITIONS,
  CUSTOM_BUTTON_SECTION_TYPES,
  CUSTOM_BUTTON_STYLES,
  CUSTOM_CTA_KINDS,
  CUSTOM_SECTION_TYPES,
};

export const MAX_CUSTOM_PAGES = 30;
export const MAX_CUSTOM_SECTIONS = 12;
export const MAX_GALLERY_ITEMS = 6;
export const MAX_PAGE_PRODUCTS = 16;
export const CUSTOM_FEATURE_COUNT = 4;
export const CUSTOM_BENEFIT_COUNT = 5;
export const MAX_ARTICLE_HEADING = 140;
export const MAX_ARTICLE_BODY = 4000;

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
const CONTENT_LOCALES: readonly ServicePagesLocale[] = ["ar", "he", "en"];

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

/** Owner-cleared / whitespace-only custom page fields stay empty. */
export function filledText(value: unknown): string {
  return cleanText(value);
}

export function visibleCustomBenefits(benefits?: string[] | null): string[] {
  return (benefits || []).map(filledText).filter(Boolean);
}

export function visibleCustomFeatures<
  T extends { title?: string; description?: string },
>(features?: T[] | null): T[] {
  return (features || []).filter(
    (feature) => filledText(feature.title) || filledText(feature.description),
  );
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

export function sanitizeArticleHeading(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripMarkup(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ARTICLE_HEADING);
}

export function sanitizeArticleBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripMarkup(value)
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_ARTICLE_BODY);
}

export function parseArticleAlign(value: unknown): CustomArticleAlign {
  return (CUSTOM_ARTICLE_ALIGNS as readonly string[]).includes(String(value))
    ? (value as CustomArticleAlign)
    : "center";
}

export function parseArticlePosition(value: unknown): CustomArticlePosition {
  return (CUSTOM_ARTICLE_POSITIONS as readonly string[]).includes(String(value))
    ? (value as CustomArticlePosition)
    : "before";
}

export function sparseSectionArticle(saved: unknown): CustomSectionArticle | undefined {
  const raw = asRecord(saved);
  const localeRaw = asRecord(raw.locales);
  const locales: NonNullable<CustomSectionArticle["locales"]> = {};
  for (const locale of ["ar", "he", "en"] as const) {
    const copyRaw = asRecord(localeRaw[locale]);
    const heading = sanitizeArticleHeading(copyRaw.heading);
    const body = sanitizeArticleBody(copyRaw.body);
    if (!heading && !body) continue;
    locales[locale] = { heading, body };
  }
  if (!Object.keys(locales).length) return undefined;
  return {
    align: parseArticleAlign(raw.align),
    position: parseArticlePosition(raw.position),
    locales,
  };
}

export function emptySectionArticleCopy(): CustomSectionArticleCopy {
  return { heading: "", body: "" };
}

export function resolveSectionArticle(
  section: CustomPageSection | undefined,
  locale: ServicePagesLocale | Locale,
): {
  heading: string;
  body: string;
  align: CustomArticleAlign;
  position: CustomArticlePosition;
} | null {
  const article = section?.article;
  if (!article) return null;
  const key: ServicePagesLocale = isServicePagesLocale(locale) ? locale : "ar";
  const copy = article.locales?.[key];
  const heading = sanitizeArticleHeading(copy?.heading);
  const body = sanitizeArticleBody(copy?.body);
  if (!heading && !body) return null;
  return {
    heading,
    body,
    align: parseArticleAlign(article.align),
    position: parseArticlePosition(article.position),
  };
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

export function parseButtonStyle(value: unknown): CustomButtonStyle {
  return (CUSTOM_BUTTON_STYLES as readonly string[]).includes(String(value))
    ? (value as CustomButtonStyle)
    : "primary";
}

export function isButtonSectionType(
  type: string | undefined,
): type is (typeof CUSTOM_BUTTON_SECTION_TYPES)[number] {
  return (CUSTOM_BUTTON_SECTION_TYPES as readonly string[]).includes(String(type));
}

export function pageUsesSectionButtons(
  sections: CustomPageSection[] | undefined,
): boolean {
  return (sections || []).some((section) => isButtonSectionType(section.type));
}

export function visibleButtonSections(
  sections: CustomPageSection[] | undefined,
): CustomPageSection[] {
  return visibleCustomSections(sections).filter((section) =>
    isButtonSectionType(section.type),
  );
}

export function emptySectionButtonCopy(): CustomSectionButtonCopy {
  return { label: "" };
}

export function defaultSectionButton(
  type: CustomSectionType,
): CustomSectionButton | undefined {
  if (type === "primaryButton") {
    return {
      style: "primary",
      align: "center",
      ctaKind: "book",
    };
  }
  if (type === "secondaryButton") {
    return {
      style: "secondary",
      align: "center",
      ctaKind: "book",
    };
  }
  return undefined;
}

/** Seed a new button section from the legacy page-level CTA without duplicating it. */
export function seedSectionButtonFromLegacy(
  type: CustomSectionType,
  legacy: {
    ctaKind?: CustomPageCtaKind;
    bookingType?: string | null;
    ctaHref?: string;
    labels?: Partial<Record<ServicePagesLocale, string>>;
  },
): CustomSectionButton {
  const base = defaultSectionButton(type) || {
    style: "primary" as const,
    align: "center" as const,
    ctaKind: "book" as const,
  };
  const ctaKind = parseCtaKind(legacy.ctaKind) || base.ctaKind;
  const locales: NonNullable<CustomSectionButton["locales"]> = {};
  for (const locale of CONTENT_LOCALES) {
    const label = filledText(legacy.labels?.[locale]);
    if (label) locales[locale] = { label };
  }
  return {
    ...base,
    ctaKind,
    bookingType: legacy.bookingType ?? null,
    ctaHref: layoutCtaHref(ctaKind, legacy.ctaHref),
    ...(Object.keys(locales).length ? { locales } : {}),
  };
}

export function sparseSectionButton(saved: unknown): CustomSectionButton | undefined {
  const raw = asRecord(saved);
  if (!Object.keys(raw).length) return undefined;
  const localeRaw = asRecord(raw.locales);
  const locales: NonNullable<CustomSectionButton["locales"]> = {};
  for (const locale of CONTENT_LOCALES) {
    const copyRaw = asRecord(localeRaw[locale]);
    const label = cleanText(copyRaw.label);
    if (!label) continue;
    locales[locale] = { label };
  }
  const bookingRaw = cleanText(raw.bookingType);
  const bookingType =
    bookingRaw && isBookingServiceKey(bookingRaw) ? bookingRaw : null;
  const parsedKind = parseCtaKind(raw.ctaKind);
  const ctaKind: CustomPageCtaKind =
    parsedKind || (bookingType ? "booking" : "book");
  const ctaHref = layoutCtaHref(ctaKind, raw.ctaHref);
  return {
    style: parseButtonStyle(raw.style),
    align: parseArticleAlign(raw.align),
    fullWidthMobile: raw.fullWidthMobile === true ? true : undefined,
    ctaKind,
    bookingType,
    ctaHref,
    ...(Object.keys(locales).length ? { locales } : {}),
  };
}

export function resolveSectionButtonLabel(
  section: CustomPageSection | undefined,
  locale: ServicePagesLocale | Locale,
): string {
  if (!section?.button) return "";
  const key: ServicePagesLocale = isServicePagesLocale(locale) ? locale : "ar";
  return filledText(section.button.locales?.[key]?.label);
}

export function resolveSectionButtonHref(
  section: CustomPageSection | undefined,
): string | null {
  const button = section?.button;
  if (!button) return null;
  return resolveCtaHref({
    ctaKind: button.ctaKind,
    bookingType: button.bookingType,
    ctaHref: button.ctaHref,
  });
}

export function createCustomSection(type: CustomSectionType): CustomPageSection {
  const button = defaultSectionButton(type);
  return {
    id: makeId("sec"),
    type,
    ...(button ? { button } : {}),
  };
}

export function legacyTemplateSections(
  template: CustomPageTemplate,
): CustomSectionType[] {
  return template === "contact-lenses"
    ? ["heroMedia", "featureGrid", "notice"]
    : ["heroMedia", "featureGrid", "benefitsList", "valuesStrip"];
}

/** New pages start empty so the owner chooses every optional section. */
export function defaultCustomSections(
  _template?: CustomPageTemplate,
): CustomPageSection[] {
  return [];
}

export function visibleCustomSections(
  sections: CustomPageSection[] | undefined,
): CustomPageSection[] {
  return (sections || []).filter((section) => !section.hidden);
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
  if (pageUsesSectionButtons(sections)) {
    return visibleButtonSections(sections).length > 0;
  }
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

function sparseCopyOrigins(
  saved: unknown,
): Record<string, "machine" | "manual"> | undefined {
  const raw = asRecord(saved);
  const origins: Record<string, "machine" | "manual"> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.trim()) continue;
    if (value === "machine" || value === "manual") origins[key] = value;
  }
  return Object.keys(origins).length ? origins : undefined;
}

export function sparseCustomPageCopy(saved: unknown): CustomPageCopy {
  const raw = asRecord(saved);
  const origins = sparseCopyOrigins(raw.origins);
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
    ...(origins ? { origins } : {}),
  };
}

function hasSection(sections: CustomPageSection[], type: CustomSectionType): boolean {
  return visibleCustomSections(sections).some((section) => section.type === type);
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
  locale: ServicePagesLocale = "ar",
): CustomPageLocaleIssue[] {
  if (!copy) return ["title", "description"];
  const issues: CustomPageLocaleIssue[] = [];
  if (!filledText(copy.title)) issues.push("title");
  if (!filledText(copy.description)) issues.push("description");
  if (pageUsesSectionButtons(sections)) {
    const missingLabel = visibleButtonSections(sections).some(
      (section) => !resolveSectionButtonLabel(section, locale),
    );
    if (missingLabel) issues.push("bookingButtonText");
  } else if (
    pageHasVisibleButton(sections, showHeroButton) &&
    !filledText(copy.bookingButtonText)
  ) {
    issues.push("bookingButtonText");
  }
  if (hasSection(sections, "featureGrid")) {
    const filled = visibleCustomFeatures(copy.features).filter(
      (feature) => filledText(feature.title) && filledText(feature.description),
    );
    if (filled.length < 2) issues.push("features");
  }
  if (hasSection(sections, "benefitsList")) {
    const items = visibleCustomBenefits(copy.benefits);
    if (!filledText(copy.benefitsTitle) || items.length < 2) issues.push("benefits");
  }
  if (hasSection(sections, "notice") && !filledText(copy.warningText)) {
    issues.push("warningText");
  }
  if (hasSection(sections, "valuesStrip")) {
    if (!filledText(copy.valuesTitle) || !filledText(copy.valuesText)) {
      issues.push("values");
    }
  }
  return issues;
}

export function isCustomPageLocaleComplete(
  sections: CustomPageSection[],
  copy: CustomPageCopy | undefined,
  showHeroButton = false,
  locale: ServicePagesLocale = "ar",
): boolean {
  return customPageLocaleIssues(sections, copy, showHeroButton, locale).length === 0;
}

export function copyForCustomPageEditor(
  page: CustomServicePage,
  locale: ServicePagesLocale,
): CustomPageCopy {
  const saved = page.locales[locale];
  return saved ? structuredClone(saved) : emptyCustomPageCopy();
}

function sparseFocal(saved: unknown): CustomPageMediaRef["desktopFocal"] {
  const raw = asRecord(saved);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const zoom = Number(raw.zoom);
  if (![x, y, zoom].every((value) => Number.isFinite(value))) return undefined;
  return { x, y, zoom };
}

export function parseCustomPageMedia(
  saved: unknown,
): CustomPageMediaRef | undefined {
  return sparseMedia(saved);
}

function sparseMedia(saved: unknown): CustomPageMediaRef | undefined {
  const raw = asRecord(saved);
  const url = cleanText(raw.url);
  if (!url) return undefined;
  const kind = raw.kind === "video" ? "video" : "image";
  const mediaId = cleanText(raw.mediaId) || undefined;
  const desktopUrl = cleanText(raw.desktopUrl) || undefined;
  const mobileUrl = cleanText(raw.mobileUrl) || undefined;
  const desktopFocal = sparseFocal(raw.desktopFocal);
  const mobileFocal = sparseFocal(raw.mobileFocal);
  const fit = raw.fit === "contain" ? "contain" : raw.fit === "cover" ? "cover" : undefined;
  return {
    kind,
    url,
    mediaId,
    desktopUrl,
    mobileUrl,
    desktopFocal,
    mobileFocal,
    fit,
  };
}

function sparseGallery(saved: unknown): CustomPageMediaRef[] {
  const list = Array.isArray(saved) ? saved : [];
  return list
    .map((item) => sparseMedia(item))
    .filter((item): item is CustomPageMediaRef => Boolean(item))
    .slice(0, MAX_GALLERY_ITEMS);
}

export function captureCustomPageLayout(page: {
  sections: CustomPageSection[];
  showHeroButton: boolean;
  ctaKind?: CustomPageCtaKind;
  bookingType?: string | null;
  ctaHref?: string;
  heroMedia?: CustomPageMediaRef;
  gallery?: CustomPageMediaRef[];
  productIds?: string[];
}): CustomPageLayout {
  const ctaKind = page.ctaKind || "book";
  return {
    sections: page.sections,
    showHeroButton: Boolean(page.showHeroButton),
    ctaKind,
    bookingType: page.bookingType ?? null,
    ctaHref: page.ctaHref,
    heroMedia: page.heroMedia,
    gallery: page.gallery || [],
    productIds: page.productIds || [],
  };
}

function layoutCtaHref(
  ctaKind: CustomPageCtaKind,
  value: unknown,
): string | undefined {
  if (ctaKind === "external") return sanitizeExternalUrl(value);
  if (ctaKind === "internal") return sanitizeInternalPath(value);
  return undefined;
}

export function sparseCustomPageLayout(
  saved: unknown,
  template: CustomPageTemplate,
): CustomPageLayout | undefined {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return undefined;
  }
  const raw = asRecord(saved);
  const bookingRaw = cleanText(raw.bookingType);
  const bookingType =
    bookingRaw && isBookingServiceKey(bookingRaw) ? bookingRaw : null;
  const parsedKind = parseCtaKind(raw.ctaKind);
  const ctaKind: CustomPageCtaKind = parsedKind || (bookingType ? "booking" : "book");
  return {
    sections: sparseSections(raw.sections, template),
    showHeroButton: Boolean(raw.showHeroButton),
    ctaKind,
    bookingType,
    ctaHref: layoutCtaHref(ctaKind, raw.ctaHref),
    heroMedia: sparseMedia(raw.heroMedia),
    gallery: sparseGallery(raw.gallery),
    productIds: uniqueProductIds(raw.productIds),
  };
}

function sparseLayouts(
  saved: unknown,
  template: CustomPageTemplate,
): CustomServicePage["layouts"] | undefined {
  const raw = asRecord(saved);
  const layouts: NonNullable<CustomServicePage["layouts"]> = {};
  for (const locale of CONTENT_LOCALES) {
    const layout = sparseCustomPageLayout(raw[locale], template);
    if (layout) layouts[locale] = layout;
  }
  return Object.keys(layouts).length ? layouts : undefined;
}

export function resolveCustomPageLayout(
  page: CustomServicePage,
  locale: ServicePagesLocale | Locale,
): CustomPageLayout {
  const key: ServicePagesLocale = isServicePagesLocale(locale) ? locale : "ar";
  return page.layouts?.[key]
    ? sparseCustomPageLayout(page.layouts[key], page.template) ||
        captureCustomPageLayout(page)
    : captureCustomPageLayout(page);
}

export function applyCustomPageLayout<T extends CustomServicePage>(
  page: T,
  layout: CustomPageLayout,
): T {
  return {
    ...page,
    sections: layout.sections,
    showHeroButton: layout.showHeroButton,
    ctaKind: layout.ctaKind,
    bookingType: layout.bookingType ?? null,
    ctaHref: layout.ctaHref,
    heroMedia: layout.heroMedia,
    gallery: layout.gallery || [],
    productIds: layout.productIds || [],
  };
}

export function customPageLayoutFingerprint(layout: CustomPageLayout): string {
  return JSON.stringify({
    sections: layout.sections.map((section) => ({
      id: section.id,
      type: section.type,
      hidden: Boolean(section.hidden),
      adminLabel: section.adminLabel || "",
      article: section.article
        ? {
            align: parseArticleAlign(section.article.align),
            position: parseArticlePosition(section.article.position),
          }
        : null,
      button: section.button
        ? {
            style: parseButtonStyle(section.button.style),
            align: parseArticleAlign(section.button.align),
            fullWidthMobile: Boolean(section.button.fullWidthMobile),
            ctaKind: section.button.ctaKind || "book",
            bookingType: section.button.bookingType || null,
            ctaHref: section.button.ctaHref || "",
          }
        : null,
    })),
    showHeroButton: Boolean(layout.showHeroButton),
    ctaKind: layout.ctaKind || "book",
    bookingType: layout.bookingType || null,
    ctaHref: layout.ctaHref || "",
    heroMedia: layout.heroMedia || null,
    gallery: layout.gallery || [],
    productIds: layout.productIds || [],
  });
}

function copyHasManualOrigins(copy: CustomPageCopy | undefined): boolean {
  if (!copy?.origins) return false;
  return Object.values(copy.origins).some((origin) => origin === "manual");
}

/** Sibling languages whose layout or manual copy would be replaced by Save to All. */
export function customPageSiblingCustomizations(
  page: CustomServicePage,
  sourceLocale: ServicePagesLocale,
  incoming?: CustomPageLayout | null,
): ServicePagesLocale[] {
  const incomingFingerprint = incoming
    ? customPageLayoutFingerprint(incoming)
    : customPageLayoutFingerprint(resolveCustomPageLayout(page, sourceLocale));
  const found: ServicePagesLocale[] = [];
  for (const locale of CONTENT_LOCALES) {
    if (locale === sourceLocale) continue;
    if (copyHasManualOrigins(page.locales[locale])) {
      found.push(locale);
      continue;
    }
    if (!page.layouts?.[locale]) continue;
    const sibling = resolveCustomPageLayout(page, locale);
    if (customPageLayoutFingerprint(sibling) !== incomingFingerprint) {
      found.push(locale);
    }
  }
  return found;
}

function isolateLayoutArticles(
  layout: CustomPageLayout,
  locale: ServicePagesLocale,
): CustomPageLayout {
  const sections = layout.sections.map((section) => {
    let next = section;
    const article = section.article;
    if (article?.locales) {
      const copy = article.locales[locale];
      const heading = sanitizeArticleHeading(copy?.heading);
      const body = sanitizeArticleBody(copy?.body);
      if (!heading && !body) {
        const { article: _article, ...rest } = next;
        next = rest;
      } else {
        next = {
          ...next,
          article: {
            align: parseArticleAlign(article.align),
            position: parseArticlePosition(article.position),
            locales: { [locale]: { heading, body } },
          },
        };
      }
    }
    const button = next.button;
    if (button?.locales) {
      const label = filledText(button.locales[locale]?.label);
      next = {
        ...next,
        button: {
          ...button,
          locales: label ? { [locale]: { label } } : undefined,
        },
      };
    }
    return next;
  });
  return { ...layout, sections };
}

function publicLayout(layout: CustomPageLayout): CustomPageLayout {
  return {
    ...layout,
    sections: publicCustomSections(layout.sections),
  };
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
  if (!Array.isArray(saved)) {
    return legacyTemplateSections(template).map((type) => createCustomSection(type));
  }
  const next: CustomPageSection[] = [];
  for (const item of saved) {
    const raw = asRecord(item);
    const type = raw.type;
    if (
      typeof type !== "string" ||
      !(CUSTOM_SECTION_TYPES as readonly string[]).includes(type)
    ) {
      continue;
    }
    const adminLabel = cleanText(raw.adminLabel);
    const article = sparseSectionArticle(raw.article);
    const sectionType = type as CustomSectionType;
    const button = isButtonSectionType(sectionType)
      ? sparseSectionButton(raw.button) || defaultSectionButton(sectionType)
      : undefined;
    next.push({
      id: cleanText(raw.id) || makeId("sec"),
      type: sectionType,
      hidden: raw.hidden === true ? true : undefined,
      adminLabel: adminLabel || undefined,
      ...(article ? { article } : {}),
      ...(button ? { button } : {}),
    });
    if (next.length >= MAX_CUSTOM_SECTIONS) break;
  }
  return next;
}

function localeCompletenessLayout(
  layouts: CustomServicePage["layouts"] | undefined,
  fallback: CustomPageLayout,
  locale: ServicePagesLocale,
): CustomPageLayout {
  return layouts?.[locale] || fallback;
}

function sparseLocales(
  saved: unknown,
  fallback: CustomPageLayout,
  layouts: CustomServicePage["layouts"] | undefined,
): CustomServicePage["locales"] {
  const raw = asRecord(saved);
  const locales: CustomServicePage["locales"] = {};
  for (const locale of CONTENT_LOCALES) {
    if (!(locale in raw)) continue;
    const copy = sparseCustomPageCopy(raw[locale]);
    const layout = localeCompletenessLayout(layouts, fallback, locale);
    copy.complete = isCustomPageLocaleComplete(
      layout.sections,
      copy,
      layout.showHeroButton,
      locale,
    );
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
  const layouts = sparseLayouts(raw.layouts, template);
  const rootLayout = captureCustomPageLayout({
    sections,
    showHeroButton,
    ctaKind,
    bookingType,
    ctaHref,
    heroMedia: sparseMedia(raw.heroMedia),
    gallery: sparseGallery(raw.gallery),
    productIds: uniqueProductIds(raw.productIds),
  });
  return {
    id,
    slug,
    name: cleanText(raw.name) || slug,
    status: raw.status === "published" ? "published" : "draft",
    template,
    showOnHome: Boolean(raw.showOnHome),
    homeSort: Number.isFinite(Number(raw.homeSort)) ? Number(raw.homeSort) : 0,
    homeImage: cleanText(raw.homeImage) || undefined,
    homeMedia: sparseMedia(raw.homeMedia) || (cleanText(raw.homeImage)
      ? { kind: "image", url: cleanText(raw.homeImage) }
      : undefined),
    showHeroButton,
    ctaKind,
    bookingType,
    ctaHref,
    sections,
    heroMedia: rootLayout.heroMedia,
    gallery: rootLayout.gallery,
    productIds: rootLayout.productIds,
    ...(layouts ? { layouts } : {}),
    locales: sparseLocales(raw.locales, rootLayout, layouts),
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

/** Display order for Admin My Pages. Does not change stored page data. */
export function listCustomPagesForEditor(
  pages: CustomServicePage[] | undefined,
  query = "",
): CustomServicePage[] {
  const list = [...(pages || [])].sort((a, b) => {
    const byDate = (b.createdAt || "").localeCompare(a.createdAt || "");
    if (byDate) return byDate;
    return a.name.localeCompare(b.name);
  });
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (item) =>
      item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q),
  );
}

function publicLocales(
  page: CustomServicePage,
): CustomServicePage["locales"] {
  const locales: CustomServicePage["locales"] = {};
  for (const locale of ["ar", "he", "en"] as const) {
    const copy = page.locales[locale];
    if (copy?.complete) {
      const { origins: _origins, ...publicCopy } = copy;
      locales[locale] = publicCopy;
    }
  }
  return locales;
}

function publicCustomSections(
  sections: CustomPageSection[],
): CustomPageSection[] {
  return sections.map((section) => {
    const { adminLabel: _adminLabel, ...rest } = section;
    return rest;
  });
}

function publicLayouts(
  page: CustomServicePage,
): CustomServicePage["layouts"] | undefined {
  if (!page.layouts) return undefined;
  const layouts: NonNullable<CustomServicePage["layouts"]> = {};
  for (const locale of CONTENT_LOCALES) {
    const layout = page.layouts[locale];
    if (!layout) continue;
    layouts[locale] = publicLayout(layout);
  }
  return Object.keys(layouts).length ? layouts : undefined;
}

export function publicCustomPages(saved: unknown): CustomServicePage[] {
  return normalizeCustomPages(saved)
    .filter((page) => page.status === "published")
    .map((page) => {
      const layouts = publicLayouts(page);
      return {
        ...page,
        sections: publicCustomSections(page.sections),
        ...(layouts ? { layouts } : { layouts: undefined }),
        locales: publicLocales(page),
      };
    })
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
  const resolved = applyCustomPageLayout(page, resolveCustomPageLayout(page, key));
  const layouts = publicLayouts(resolved);
  return {
    page: {
      ...resolved,
      sections: publicCustomSections(resolved.sections),
      ...(layouts ? { layouts } : { layouts: undefined }),
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
  if (pageUsesSectionButtons(page.sections)) {
    for (const section of visibleButtonSections(page.sections)) {
      const kind = section.button?.ctaKind || "book";
      if (kind !== "internal" && kind !== "external") continue;
      if (resolveSectionButtonHref(section)) continue;
      throw new CustomPageError("CUSTOM_PAGE_INVALID_CTA");
    }
    return;
  }
  if (!pageHasVisibleButton(page.sections, page.showHeroButton)) return;
  if (resolveCtaHref(page)) return;
  throw new CustomPageError("CUSTOM_PAGE_INVALID_CTA");
}

function requireRevision(page: CustomServicePage, expected: unknown): void {
  if (Number(expected) !== page.revision) {
    throw new CustomPageConflictError(page.id);
  }
}

function incomingLayoutFromOp(
  page: CustomServicePage,
  op: Extract<CustomPageOp, { op: "update" }>,
): CustomPageLayout | undefined {
  const hasLayoutField =
    op.sections != null ||
    op.showHeroButton != null ||
    op.ctaKind != null ||
    op.bookingType !== undefined ||
    op.ctaHref !== undefined ||
    op.heroMedia !== undefined ||
    op.gallery != null ||
    op.productIds != null;
  if (!hasLayoutField) return undefined;
  const base =
    op.syncLocales === "current" && op.locale
      ? resolveCustomPageLayout(page, op.locale)
      : captureCustomPageLayout(page);
  const bookingType =
    op.bookingType === null
      ? null
      : op.bookingType != null
        ? cleanText(op.bookingType) && isBookingServiceKey(op.bookingType)
          ? op.bookingType
          : base.bookingType
        : base.bookingType;
  let ctaKind: CustomPageCtaKind = base.ctaKind || "book";
  if (op.ctaKind != null) {
    ctaKind = parseCtaKind(op.ctaKind) || ctaKind;
  } else if (op.bookingType != null && bookingType) {
    ctaKind = "booking";
  } else if (op.bookingType === null && ctaKind === "booking") {
    ctaKind = "book";
  }
  const ctaHrefRaw =
    op.ctaHref === null ? undefined : op.ctaHref != null ? op.ctaHref : base.ctaHref;
  return {
    sections: op.sections
      ? sparseSections(op.sections, page.template)
      : base.sections,
    showHeroButton:
      op.showHeroButton != null ? Boolean(op.showHeroButton) : base.showHeroButton,
    ctaKind,
    bookingType,
    ctaHref: layoutCtaHref(ctaKind, ctaHrefRaw),
    heroMedia:
      op.heroMedia === null
        ? undefined
        : op.heroMedia != null
          ? sparseMedia(op.heroMedia)
          : base.heroMedia,
    gallery: op.gallery ? sparseGallery(op.gallery) : base.gallery || [],
    productIds:
      op.productIds != null ? uniqueProductIds(op.productIds) : base.productIds || [],
  };
}

function stampLocaleCompleteness(page: CustomServicePage): void {
  const locales: CustomServicePage["locales"] = {};
  for (const locale of CONTENT_LOCALES) {
    const copy = page.locales[locale];
    if (!copy) continue;
    const layout = resolveCustomPageLayout(page, locale);
    locales[locale] = {
      ...copy,
      complete: isCustomPageLocaleComplete(
        layout.sections,
        copy,
        layout.showHeroButton,
        locale,
      ),
    };
  }
  page.locales = locales;
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
  const sync =
    op.syncLocales === "current" && op.locale
      ? "current"
      : op.syncLocales === "all"
        ? "all"
        : "legacy";
  const incomingLayout = incomingLayoutFromOp(page, op);
  const rootLayout =
    sync === "current"
      ? captureCustomPageLayout(page)
      : incomingLayout || captureCustomPageLayout(page);
  const sections = rootLayout.sections;
  const showHeroButton = rootLayout.showHeroButton;
  const bookingType = rootLayout.bookingType;
  const ctaKind = rootLayout.ctaKind;
  const ctaHref = rootLayout.ctaHref;
  if (op.status === "published") {
    const locales = { ...page.locales };
    if (op.locale && op.copy) {
      const copy = sparseCustomPageCopy(op.copy);
      const layout = incomingLayout || rootLayout;
      copy.complete = isCustomPageLocaleComplete(
        layout.sections,
        copy,
        layout.showHeroButton,
        op.locale,
      );
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
    homeMedia:
      op.homeMedia === null
        ? undefined
        : op.homeMedia != null
          ? sparseMedia(op.homeMedia)
          : page.homeMedia,
    showHeroButton,
    ctaKind,
    bookingType,
    ctaHref,
    sections,
    heroMedia: rootLayout.heroMedia,
    gallery: rootLayout.gallery,
    productIds: rootLayout.productIds || [],
    locales: { ...page.locales },
    updatedAt: new Date().toISOString(),
    revision: page.revision + 1,
  };
  if (sync === "current" && incomingLayout && op.locale) {
    next.layouts = {
      ...(page.layouts || {}),
      [op.locale]: isolateLayoutArticles(incomingLayout, op.locale),
    };
  } else if (sync === "all" && incomingLayout) {
    next.layouts = {
      ar: structuredClone(incomingLayout),
      he: structuredClone(incomingLayout),
      en: structuredClone(incomingLayout),
    };
  }
  if (next.homeMedia?.url) next.homeImage = next.homeMedia.url;
  else if (op.homeMedia === null) next.homeImage = undefined;
  if (op.locale && op.copy) {
    const copy = sparseCustomPageCopy(op.copy);
    next.locales = { ...next.locales, [op.locale]: copy };
  }
  if (sync !== "current" && op.locales) {
    const extra: CustomServicePage["locales"] = { ...next.locales };
    for (const locale of CONTENT_LOCALES) {
      if (locale === op.locale) continue;
      const incoming = op.locales[locale];
      if (!incoming) continue;
      extra[locale] = sparseCustomPageCopy(incoming);
    }
    next.locales = extra;
  }
  stampLocaleCompleteness(next);
  if (next.status === "published") {
    const anyComplete = Object.values(next.locales).some((copy) => copy?.complete);
    if (!anyComplete) throw new CustomPageError("CUSTOM_PAGE_PUBLISH_INCOMPLETE");
  }
  const ctaPage =
    sync === "current" && incomingLayout
      ? applyCustomPageLayout(next, incomingLayout)
      : next;
  assertSafeCta(ctaPage);
  if (
    !pageUsesSectionButtons(ctaPage.sections) &&
    pageHasVisibleButton(ctaPage.sections, ctaPage.showHeroButton) &&
    (ctaKind === "internal" || ctaKind === "external") &&
    op.ctaHref != null &&
    op.ctaHref !== "" &&
    !ctaPage.ctaHref
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
      showHeroButton: false,
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
