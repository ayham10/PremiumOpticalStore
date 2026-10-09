import { persistServicePages, localePatchPayload } from "@/lib/service-pages";
import { isRtl, type Locale } from "@/lib/i18n/config";
import type {
  CustomServicePage,
  Product,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
} from "@/lib/types";

export const CONTENT_PREVIEW_MESSAGE = "oyon-content-preview";
export const CONTENT_PREVIEW_READY = "oyon-content-preview-ready";
export const CONTENT_PREVIEW_VISIBILITY = "oyon-content-preview-visibility";
export const CONTENT_PREVIEW_PATH = "/admin/service-pages/preview";
/** Coalesce keystrokes so iframe documents are patched, not reloaded. */
export const PREVIEW_UPDATE_MS = 220;
const PREVIEW_WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const CONTENT_PREVIEW_VIEWPORTS = {
  mobile: { width: 390, height: 844, label: "mobile" },
  desktop: { width: 1280, height: 900, label: "desktop" },
} as const;

export type ContentPreviewKind =
  | "homepage"
  | "eyeExam"
  | "contactLenses"
  | "footer"
  | "custom";

export type ContentPreviewPayload = {
  locale: ServicePagesLocale;
  kind: ContentPreviewKind;
  document?: ServicePagesSettings;
  customPage?: CustomServicePage | null;
  products?: Array<Pick<Product, "id" | "name" | "category" | "sellingPrice" | "status" | "slug" | "images">>;
};

export type ContentPreviewMessage = {
  type: typeof CONTENT_PREVIEW_MESSAGE;
  payload: ContentPreviewPayload;
};

export type ContentPreviewVisibilityMessage = {
  type: typeof CONTENT_PREVIEW_VISIBILITY;
  visible: boolean;
};

export function previewFlushKey(
  locale: string,
  kind: string,
  pageId?: string | null,
): string {
  return `${locale}:${kind}:${pageId || ""}`;
}

export function shouldFlushPreviewNow(
  previousKey: string | null,
  nextKey: string,
): boolean {
  return !previousKey || previousKey !== nextKey;
}

export function previewWriteMethodBlocked(method?: string | null): boolean {
  return PREVIEW_WRITE_METHODS.has((method || "GET").toUpperCase());
}

export function isContentPreviewVisibilityMessage(
  value: unknown,
): value is ContentPreviewVisibilityMessage {
  if (!value || typeof value !== "object") return false;
  const raw = value as { type?: unknown; visible?: unknown };
  return raw.type === CONTENT_PREVIEW_VISIBILITY && typeof raw.visible === "boolean";
}

export function isContentPreviewMessage(
  value: unknown,
): value is ContentPreviewMessage {
  if (!value || typeof value !== "object") return false;
  const raw = value as { type?: unknown; payload?: unknown };
  if (raw.type !== CONTENT_PREVIEW_MESSAGE) return false;
  const payload = raw.payload as ContentPreviewPayload | undefined;
  return Boolean(
    payload &&
      (payload.locale === "ar" ||
        payload.locale === "he" ||
        payload.locale === "en") &&
      payload.kind,
  );
}

export function editorPanelDir(
  locale: ServicePagesLocale,
): "rtl" | "ltr" {
  return isRtl(locale as Locale) ? "rtl" : "ltr";
}

export function viewHrefForEditor(
  kind: ContentPreviewKind,
  slug?: string,
): string {
  if (kind === "homepage") return "/";
  if (kind === "eyeExam") return "/eye-exams";
  if (kind === "contactLenses") return "/contact-lenses";
  if (kind === "footer") return "/#footer";
  const safe = (slug || "").replace(/^\/+|\/+$/g, "");
  return safe ? `/services/${safe}` : "/services";
}

export function buildEditorPreviewDocument(
  saved: ServicePagesSettings | undefined,
  locale: ServicePagesLocale,
  bundle: ServicePagesLocaleBundle,
  customDraft?: CustomServicePage | null,
): ServicePagesSettings {
  const patched = persistServicePages(
    saved,
    localePatchPayload(locale, bundle, { includeHomepage: true }),
  );
  if (!customDraft) return patched;
  const pages = [...(patched.customPages || [])];
  const index = pages.findIndex((page) => page.id === customDraft.id);
  if (index >= 0) pages[index] = customDraft;
  else pages.push(customDraft);
  return { ...patched, customPages: pages };
}

export function snapshotForDirty(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function customPageEditorSnapshot(page: {
  name: string;
  slug: string;
  status: CustomServicePage["status"];
  showOnHome: boolean;
  homeSort: number;
  homeImage?: string;
  showHeroButton: boolean;
  ctaKind: CustomServicePage["ctaKind"];
  ctaHref?: string;
  bookingType?: string | null;
  sections: CustomServicePage["sections"];
  heroMedia?: CustomServicePage["heroMedia"];
  gallery?: CustomServicePage["gallery"];
  productIds?: string[];
  copy: unknown;
}): string {
  return snapshotForDirty({
    name: page.name,
    slug: page.slug,
    status: page.status,
    showOnHome: page.showOnHome,
    homeSort: page.homeSort,
    homeImage: page.homeImage || "",
    showHeroButton: page.showHeroButton,
    ctaKind: page.ctaKind,
    ctaHref: page.ctaHref || "",
    bookingType: page.bookingType || "",
    sections: page.sections,
    heroMedia: page.heroMedia || null,
    gallery: page.gallery || [],
    productIds: page.productIds || [],
    copy: page.copy,
  });
}
