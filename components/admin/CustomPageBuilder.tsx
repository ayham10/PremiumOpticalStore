"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutGrid,
  ListChecks,
  Package,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import ResponsiveHeroImageField from "@/components/admin/ResponsiveHeroImageField";
import ContentEditorToolbar from "@/components/admin/content-editor/ContentEditorToolbar";
import EditorSection from "@/components/admin/content-editor/EditorSection";
import NewPageWizardBar from "@/components/admin/content-editor/NewPageWizardBar";
import {
  clampWizardStep,
  type NewPageWizardStep,
} from "@/lib/content-editor-wizard";
import AdminModal from "@/components/admin/AdminModal";
import AdminProductCreateModal from "@/components/admin/AdminProductCreateModal";
import AdminProductPicker from "@/components/admin/AdminProductPicker";
import type { CustomPageProductCard } from "@/components/services/CustomPageProductsCarousel";
import { ApiError, apiFetch } from "@/lib/admin-api";
import { formatPrice } from "@/lib/format";
import { isRtl, type Locale } from "@/lib/i18n/config";
import {
  customPageEditorSnapshot,
  snapshotForDirty,
  viewHrefForEditor,
} from "@/lib/content-editor-preview";
import {
  ADDABLE_CUSTOM_SECTION_TYPES,
  attachProductIds,
  copyForCustomPageEditor,
  createCustomSection,
  customPageLocaleIssues,
  detachProductId,
  emptyCustomPageCopy,
  type CustomPageLocaleIssue,
  MAX_CUSTOM_SECTIONS,
  MAX_PAGE_PRODUCTS,
  pageHasVisibleButton,
  parseCtaKind,
  PUBLIC_INTERNAL_PATHS,
  resolveCustomPageProducts,
  sanitizeExternalUrl,
  sanitizeInternalPath,
  normalizeCustomSlug,
  RESERVED_SERVICE_SLUGS,
} from "@/lib/custom-service-pages";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  SERVICE_FEATURE_ICON_IDS,
  SERVICE_FEATURE_ICONS,
  pickServiceFeatureIcon,
  type ServiceFeatureIconId,
} from "@/lib/service-page-icons";
import type {
  CustomPageCopy,
  CustomPageCtaKind,
  CustomPageMediaRef,
  CustomPageOp,
  CustomPageSection,
  CustomSectionType,
  CustomServicePage,
  Product,
  ServicePagesLocale,
  StoreSettings,
} from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

const INTERNAL_PATH_I18N: Record<string, string> = {
  "/": "admin.servicePages.internalHome",
  "/book": "admin.servicePages.internalBook",
  "/shop": "admin.servicePages.internalShop",
  "/frames": "admin.servicePages.internalFrames",
  "/sunglasses": "admin.servicePages.internalSunglasses",
  "/contact-lenses": "admin.servicePages.internalContactLenses",
  "/eye-exams": "admin.servicePages.internalEyeExams",
  "/about": "admin.servicePages.internalAbout",
  "/gallery": "admin.servicePages.internalGallery",
  "/promotions": "admin.servicePages.internalPromotions",
  "/contact": "admin.servicePages.internalContact",
  "/privacy": "admin.servicePages.internalPrivacy",
};

const ISSUE_I18N: Record<CustomPageLocaleIssue, string> = {
  title: "admin.servicePages.issueTitle",
  description: "admin.servicePages.issueDescription",
  bookingButtonText: "admin.servicePages.issueBooking",
  features: "admin.servicePages.issueFeatures",
  benefits: "admin.servicePages.issueBenefits",
  warningText: "admin.servicePages.issueWarning",
  values: "admin.servicePages.issueValues",
};

const SECTION_I18N: Record<CustomSectionType, string> = {
  heroMedia: "admin.servicePages.sectionHero",
  featureGrid: "admin.servicePages.sectionFeatures",
  benefitsList: "admin.servicePages.sectionBenefits",
  notice: "admin.servicePages.sectionNotice",
  valuesStrip: "admin.servicePages.sectionValues",
  bookingCta: "admin.servicePages.sectionBooking",
  gallery: "admin.servicePages.sectionGallery",
  products: "admin.servicePages.sectionProducts",
};

const SECTION_HINT_I18N: Record<Exclude<CustomSectionType, "gallery">, string> = {
  heroMedia: "admin.servicePages.sectionHeroHint",
  featureGrid: "admin.servicePages.sectionFeaturesHint",
  benefitsList: "admin.servicePages.sectionBenefitsHint",
  notice: "admin.servicePages.sectionNoticeHint",
  valuesStrip: "admin.servicePages.sectionValuesHint",
  bookingCta: "admin.servicePages.sectionBookingHint",
  products: "admin.servicePages.sectionProductsHint",
};

const SECTION_ICONS = {
  heroMedia: ImageIcon,
  featureGrid: LayoutGrid,
  benefitsList: ListChecks,
  notice: AlertTriangle,
  valuesStrip: Sparkles,
  bookingCta: CalendarDays,
  products: Package,
  gallery: ImageIcon,
} as const;

function customPageErrorMessage(error: unknown, t: Translate): string {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof ApiError && error.status === 409) {
    return t("admin.servicePages.conflict");
  }
  if (message === "CUSTOM_PAGE_SLUG_TAKEN") return t("admin.servicePages.slugTaken");
  if (message === "CUSTOM_PAGE_RESERVED") return t("admin.servicePages.slugReserved");
  if (message === "CUSTOM_PAGE_INVALID_SLUG") return t("admin.servicePages.slugInvalid");
  if (message === "CUSTOM_PAGE_PUBLISH_INCOMPLETE") {
    return t("admin.servicePages.publishIncomplete");
  }
  if (message === "CUSTOM_PAGE_INVALID_CTA") {
    return t("admin.servicePages.ctaInvalid");
  }
  if (message === "CUSTOM_PAGE_LIMIT") return t("admin.servicePages.pageLimit");
  return message || t("admin.servicePages.saveError");
}

export function CreateCustomPageModal({
  open,
  t,
  existingSlugs = [],
  onClose,
  onCreated,
}: {
  open: boolean;
  t: Translate;
  existingSlugs?: string[];
  onClose: () => void;
  onCreated: (page: CustomServicePage, document: StoreSettings["servicePages"]) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setSaving(false);
    setError("");
  }, [open]);

  function updateName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(normalizeCustomSlug(value));
  }

  async function create() {
    setSaving(true);
    setError("");
    try {
      const saved = await apiFetch<{ settings: StoreSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: {
            servicePages: {
              customPageOp: {
                op: "create",
                name: name.trim(),
                slug,
              } satisfies CustomPageOp,
            },
          },
        }),
      });
      const pages = saved.settings?.servicePages?.customPages || [];
      const created =
        pages.find((item) => item.slug === normalizeCustomSlug(slug)) ||
        pages[pages.length - 1];
      if (!created) throw new Error(t("admin.servicePages.saveError"));
      onCreated(created, saved.settings?.servicePages);
      onClose();
    } catch (err) {
      setError(customPageErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  const normalized = normalizeCustomSlug(slug);
  const slugTaken = existingSlugs.includes(normalized);
  const slugReserved = RESERVED_SERVICE_SLUGS.has(normalized);
  const slugInvalid = Boolean(slug.trim()) && normalized.length < 2;
  const canCreate =
    name.trim().length > 1 &&
    normalized.length >= 2 &&
    !slugReserved &&
    !slugTaken;

  return (
    <AdminModal
      open={open}
      title={t("admin.servicePages.addPage")}
      onClose={onClose}
      icon={<Plus size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <label className="admin-service-field">
        <span className="label">{t("admin.servicePages.pageName")}</span>
        <input
          className="input"
          value={name}
          onChange={(event) => updateName(event.target.value)}
        />
        <p className="admin-muted">{t("admin.servicePages.pageNameHint")}</p>
      </label>
      <label className="admin-service-field">
        <span className="label">{t("admin.servicePages.pageSlug")}</span>
        <span className="csp-slug-prefix" dir="ltr">
          /services/
        </span>
        <input
          className="input"
          dir="ltr"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
        <p className="admin-muted">{t("admin.servicePages.pageSlugHint")}</p>
        {normalized ? (
          <p className="admin-muted" dir="ltr">
            /services/{normalized}
          </p>
        ) : null}
        {slugTaken ? (
          <p className="csp-issues">{t("admin.servicePages.slugTaken")}</p>
        ) : null}
        {slugReserved ? (
          <p className="csp-issues">{t("admin.servicePages.slugReserved")}</p>
        ) : null}
        {slugInvalid ? (
          <p className="csp-issues">{t("admin.servicePages.slugInvalid")}</p>
        ) : null}
      </label>
      <div className="admin-service-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          {t("admin.servicePages.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void create()}
          disabled={saving || !canCreate}
        >
          {saving ? t("admin.servicePages.saving") : t("admin.servicePages.createPage")}
        </button>
      </div>
    </AdminModal>
  );
}

export default function CustomPageBuilder({
  page,
  editLocale,
  t,
  onDocument,
  onDeleted,
  onDraftChange,
  wizardMode = false,
  activeSectionId = null,
  onActiveSectionChange,
}: {
  page: CustomServicePage;
  editLocale: ServicePagesLocale;
  t: Translate;
  onDocument: (settings: StoreSettings["servicePages"]) => void;
  onDeleted: () => void;
  onDraftChange?: (draft: {
    page: CustomServicePage;
    products: CustomPageProductCard[];
    dirty: boolean;
  }) => void;
  wizardMode?: boolean;
  activeSectionId?: string | null;
  onActiveSectionChange?: (id: string) => void;
}) {
  const editorDir = isRtl(editLocale as Locale) ? "rtl" : "ltr";
  const [name, setName] = useState(page.name);
  const [slug, setSlug] = useState(page.slug);
  const [revision, setRevision] = useState(page.revision);
  const [status, setStatus] = useState(page.status);
  const [showOnHome, setShowOnHome] = useState(page.showOnHome);
  const [homeSort, setHomeSort] = useState(page.homeSort);
  const [homeImage, setHomeImage] = useState(page.homeImage || "");
  const [homeMedia, setHomeMedia] = useState<CustomPageMediaRef | undefined>(
    page.homeMedia || (page.homeImage ? { kind: "image", url: page.homeImage } : undefined),
  );
  const [showHeroButton, setShowHeroButton] = useState(page.showHeroButton);
  const [ctaKind, setCtaKind] = useState<CustomPageCtaKind>(page.ctaKind || "book");
  const [ctaHref, setCtaHref] = useState(page.ctaHref || "");
  const [bookingType, setBookingType] = useState(page.bookingType || "");
  const [sections, setSections] = useState(page.sections);
  const [heroMedia, setHeroMedia] = useState<CustomPageMediaRef | undefined>(
    page.heroMedia,
  );
  const [gallery, setGallery] = useState<CustomPageMediaRef[]>(page.gallery || []);
  const [productIds, setProductIds] = useState<string[]>(page.productIds || []);
  const [catalog, setCatalog] = useState<CustomPageProductCard[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productCreateOpen, setProductCreateOpen] = useState(false);
  const [copies, setCopies] = useState<Record<ServicePagesLocale, CustomPageCopy>>({
    ar: copyForCustomPageEditor(page, "ar"),
    he: copyForCustomPageEditor(page, "he"),
    en: copyForCustomPageEditor(page, "en"),
  });
  const [bookingOptions, setBookingOptions] = useState<Array<{ key: string; name: string }>>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [wizardStep, setWizardStep] = useState<NewPageWizardStep>(1);
  const skipRevisionReset = useRef(false);

  useEffect(() => {
    setWizardStep(1);
  }, [page.id]);

  function activateSection(id: string) {
    onActiveSectionChange?.(id);
  }

  function showStep(step: NewPageWizardStep) {
    return !wizardMode || wizardStep === step;
  }

  function foldProps(sectionId: string) {
    return {
      sectionId,
      active: activeSectionId === sectionId,
      onActivate: activateSection,
    };
  }

  function hydrateFrom(next: CustomServicePage) {
    setName(next.name);
    setSlug(next.slug);
    setRevision(next.revision);
    setStatus(next.status);
    setShowOnHome(next.showOnHome);
    setHomeSort(next.homeSort);
    setHomeImage(next.homeImage || "");
    setHomeMedia(
      next.homeMedia ||
        (next.homeImage ? { kind: "image", url: next.homeImage } : undefined),
    );
    setShowHeroButton(next.showHeroButton);
    setCtaKind(next.ctaKind || "book");
    setCtaHref(next.ctaHref || "");
    setBookingType(next.bookingType || "");
    setSections(next.sections);
    setHeroMedia(next.heroMedia);
    setGallery(next.gallery || []);
    setProductIds(next.productIds || []);
    setCopies({
      ar: copyForCustomPageEditor(next, "ar"),
      he: copyForCustomPageEditor(next, "he"),
      en: copyForCustomPageEditor(next, "en"),
    });
  }

  useEffect(() => {
    hydrateFrom(page);
    setMessage("");
    setError("");
  }, [page.id]);

  useEffect(() => {
    if (skipRevisionReset.current) {
      skipRevisionReset.current = false;
      return;
    }
    if (page.revision !== revision) {
      hydrateFrom(page);
    }
  }, [page.revision, page.id]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<unknown>("/api/products?all=1")
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : data && typeof data === "object" && Array.isArray((data as { products?: unknown }).products)
            ? (data as { products: Product[] }).products
            : [];
        setCatalog(list as CustomPageProductCard[]);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ services: Array<{ key: string; name: string }> }>(
      `/api/booking-services?locale=${editLocale}`,
    )
      .then((data) => {
        if (!cancelled) setBookingOptions(data.services || []);
      })
      .catch(() => {
        if (!cancelled) setBookingOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editLocale]);

  const copy = copies[editLocale] || emptyCustomPageCopy();
  const issues = customPageLocaleIssues(sections, copy, showHeroButton);
  const buttonVisible = pageHasVisibleButton(sections, showHeroButton);
  const localeComplete = issues.length === 0;
  const savedComplete = Boolean(page.locales[editLocale]?.complete);

  function updateCopy<K extends keyof CustomPageCopy>(key: K, value: CustomPageCopy[K]) {
    setCopies((prev) => ({
      ...prev,
      [editLocale]: { ...prev[editLocale], [key]: value, complete: false },
    }));
  }

  function moveSection(index: number, delta: number) {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    setSections(next);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((section) => section.id !== id));
  }

  function toggleSectionHidden(id: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, hidden: !section.hidden } : section,
      ),
    );
  }

  function addSection(type: CustomSectionType) {
    if (sections.some((section) => section.type === type)) return;
    if (sections.length >= MAX_CUSTOM_SECTIONS) return;
    const section = createCustomSection(type);
    setSections((prev) =>
      type === "heroMedia" ? [section, ...prev] : [...prev, section],
    );
    activateSection(section.id);
  }

  function ensureProductsSection(nextSections = sections) {
    if (nextSections.some((section) => section.type === "products")) {
      return nextSections;
    }
    if (nextSections.length >= MAX_CUSTOM_SECTIONS) return nextSections;
    const withProducts = [...nextSections, createCustomSection("products")];
    setSections(withProducts);
    return withProducts;
  }

  function attachProducts(products: Product[]) {
    const nextIds = attachProductIds(
      productIds,
      products.map((product) => product.id),
    );
    setProductIds(nextIds);
    setCatalog((prev) => {
      const seen = new Set(prev.map((item) => item.id));
      const extra = products.filter((product) => !seen.has(product.id));
      return extra.length ? [...extra, ...prev] : prev;
    });
    ensureProductsSection();
  }

  function removeProductFromPage(id: string) {
    setProductIds((prev) => detachProductId(prev, id));
  }

  function applySaved(saved: CustomServicePage) {
    skipRevisionReset.current = true;
    setName(saved.name);
    setSlug(saved.slug);
    setRevision(saved.revision);
    setStatus(saved.status);
    setShowOnHome(saved.showOnHome);
    setHomeSort(saved.homeSort);
    setHomeImage(saved.homeImage || "");
    setHomeMedia(
      saved.homeMedia ||
        (saved.homeImage ? { kind: "image", url: saved.homeImage } : undefined),
    );
    setShowHeroButton(saved.showHeroButton);
    setCtaKind(saved.ctaKind || "book");
    setCtaHref(saved.ctaHref || "");
    setBookingType(saved.bookingType || "");
    setSections(saved.sections);
    setHeroMedia(saved.heroMedia);
    setGallery(saved.gallery || []);
    setProductIds(saved.productIds || []);
    setCopies((prev) => ({
      ...prev,
      [editLocale]: copyForCustomPageEditor(saved, editLocale),
    }));
  }

  async function submit(statusOverride?: CustomServicePage["status"]) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const op: Extract<CustomPageOp, { op: "update" }> = {
        op: "update",
        id: page.id,
        expectedRevision: revision,
        name,
        slug,
        status: statusOverride ?? status,
        showOnHome,
        homeSort,
        homeImage: homeMedia?.url || homeImage || null,
        homeMedia: homeMedia || null,
        showHeroButton,
        ctaKind,
        bookingType: ctaKind === "booking" ? bookingType || null : null,
        ctaHref:
          ctaKind === "internal" || ctaKind === "external" ? ctaHref || null : null,
        sections,
        heroMedia: heroMedia || null,
        gallery,
        productIds,
        locale: editLocale,
        copy,
      };
      const saved = await apiFetch<{ settings: StoreSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: { servicePages: { customPageOp: op } } }),
      });
      const nextDoc = saved.settings?.servicePages;
      const nextPage = nextDoc?.customPages?.find((item) => item.id === page.id);
      if (nextPage) applySaved(nextPage);
      onDocument(nextDoc);
      setMessage(t("admin.servicePages.saved"));
    } catch (err) {
      setError(customPageErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  }

  async function removePage() {
    if (!confirm(t("admin.servicePages.deleteConfirm"))) return;
    setSaving(true);
    setError("");
    try {
      const saved = await apiFetch<{ settings: StoreSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: {
            servicePages: {
              customPageOp: {
                op: "delete",
                id: page.id,
                expectedRevision: revision,
              } satisfies CustomPageOp,
            },
          },
        }),
      });
      onDocument(saved.settings?.servicePages);
      onDeleted();
    } catch (err) {
      setError(customPageErrorMessage(err, t));
      setSaving(false);
    }
  }

  const previewPage: CustomServicePage = {
    ...page,
    name,
    slug,
    status,
    showOnHome,
    homeSort,
    homeImage: homeMedia?.url || homeImage || undefined,
    homeMedia,
    showHeroButton,
    ctaKind,
    bookingType: ctaKind === "booking" ? bookingType || null : null,
    ctaHref:
      ctaKind === "internal" || ctaKind === "external" ? ctaHref || undefined : undefined,
    sections,
    heroMedia,
    gallery,
    productIds,
    locales: {
      [editLocale]: {
        ...copy,
        complete: localeComplete,
      },
    },
  };

  const attachedProducts = resolveCustomPageProducts(catalog, productIds, {
    includeDrafts: true,
  });
  const dirty =
    customPageEditorSnapshot({
      name,
      slug,
      status,
      showOnHome,
      homeSort,
      homeImage,
      homeMedia,
      showHeroButton,
      ctaKind,
      ctaHref,
      bookingType,
      sections,
      heroMedia,
      gallery,
      productIds,
      copy,
    }) !==
    customPageEditorSnapshot({
      name: page.name,
      slug: page.slug,
      status: page.status,
      showOnHome: page.showOnHome,
      homeSort: page.homeSort,
      homeImage: page.homeImage,
      homeMedia: page.homeMedia,
      showHeroButton: page.showHeroButton,
      ctaKind: page.ctaKind,
      ctaHref: page.ctaHref,
      bookingType: page.bookingType,
      sections: page.sections,
      heroMedia: page.heroMedia,
      gallery: page.gallery,
      productIds: page.productIds,
      copy: copyForCustomPageEditor(page, editLocale),
    });

  const draftKey = snapshotForDirty({
    page: previewPage,
    products: attachedProducts.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.images?.[0] || "",
      price: item.sellingPrice,
    })),
    dirty,
  });
  useEffect(() => {
    onDraftChange?.({
      page: previewPage,
      products: attachedProducts,
      dirty,
    });
    // draftKey captures the unsaved editor snapshot; avoid identity loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const missingTypes = ADDABLE_CUSTOM_SECTION_TYPES.filter(
    (type) => !sections.some((section) => section.type === type),
  );

  return (
    <div className="admin-service-editor space-y-4" dir={editorDir}>
      <ContentEditorToolbar
        t={t}
        saving={saving}
        dirty={dirty}
        status={status}
        localeComplete={localeComplete}
        viewHref={viewHrefForEditor("custom", slug)}
        onSave={() => void submit()}
        extra={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void removePage()}
              disabled={saving}
            >
              <Trash2 size={15} />
              {t("admin.servicePages.deletePage")}
            </button>
            {status === "published" ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void submit("draft")}
                disabled={saving}
              >
                {t("admin.servicePages.unpublish")}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void submit("published")}
                disabled={saving}
              >
                <Eye size={15} />
                {t("admin.servicePages.publish")}
              </button>
            )}
          </>
        }
      />
      {wizardMode ? (
        <NewPageWizardBar
          step={wizardStep}
          t={t}
          dir={editorDir}
          onStepChange={(next) => setWizardStep(clampWizardStep(next))}
        />
      ) : null}
      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {showStep(1) ? (
      <EditorSection
        icon="page"
        title={t("admin.servicePages.groupPageDetails")}
        defaultOpen={wizardMode}
        {...foldProps("page-details")}
      >
        <p className="admin-muted">{t("admin.servicePages.localeHiddenHint")}</p>
        <BuilderField
          label={t("admin.servicePages.pageName")}
          value={name}
          onChange={setName}
          dir={editorDir}
          lang={editLocale}
        />
        <label className="admin-service-field">
          <span className="label">{t("admin.servicePages.pageSlug")}</span>
          <span className="csp-slug-prefix">/services/</span>
          <input
            className="input"
            dir="ltr"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
        {!localeComplete ? (
          <ul className="csp-issues">
            {issues.map((issue) => (
              <li key={issue}>{t(ISSUE_I18N[issue])}</li>
            ))}
          </ul>
        ) : null}
        {savedComplete ? null : (
          <p className="admin-muted">{t("admin.servicePages.unsavedLocale")}</p>
        )}
      </EditorSection>
      ) : null}

      {showStep(2) ? (
      <EditorSection
        icon="sections"
        title={t("admin.servicePages.groupSections")}
        defaultOpen={wizardMode}
        {...foldProps("page-sections")}
      >
        <p className="admin-muted">{t("admin.servicePages.addSectionHint")}</p>
        <div className="csp-section-list">
          {sections.map((section, index) => {
            const Icon = SECTION_ICONS[section.type];
            return (
              <div
                key={section.id}
                className={[
                  "csp-section-row",
                  section.hidden ? "is-hidden" : "",
                  activeSectionId === section.id ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => activateSection(section.id)}
              >
                <span className="csp-section-label">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  <span>
                    {t(SECTION_I18N[section.type])}
                    {section.hidden ? ` — ${t("admin.servicePages.hiddenSection")}` : ""}
                  </span>
                </span>
                <span className="csp-section-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => toggleSectionHidden(section.id)}
                  >
                    {section.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                    {section.hidden
                      ? t("admin.servicePages.showSection")
                      : t("admin.servicePages.hideSection")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => moveSection(index, -1)}
                    aria-label={t("admin.servicePages.moveUp")}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => moveSection(index, 1)}
                    aria-label={t("admin.servicePages.moveDown")}
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeSection(section.id)}
                  >
                    {t("admin.servicePages.removeSection")}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        {missingTypes.length ? (
          <div className="csp-add-sections">
            {missingTypes.map((type) => {
              const Icon = SECTION_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  className="csp-add-section"
                  onClick={() => addSection(type)}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                  <span>
                    <strong>{t(SECTION_I18N[type])}</strong>
                    <em>{t(SECTION_HINT_I18N[type])}</em>
                  </span>
                  <Plus size={14} />
                </button>
              );
            })}
          </div>
        ) : null}
      </EditorSection>
      ) : null}

      {showStep(3) ? (
      <>
      {wizardMode &&
      !sections.some((section) => section.type !== "gallery") ? (
        <p className="admin-muted">{t("admin.servicePages.wizardNoSections")}</p>
      ) : null}
      {sections.map((section) => {
        if (section.type === "gallery") return null;
        const title = `${t(SECTION_I18N[section.type])}${
          section.hidden ? ` — ${t("admin.servicePages.hiddenSection")}` : ""
        }`;
        if (section.type === "heroMedia") {
          return (
            <EditorSection
              key={section.id}
              icon="hero"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <ResponsiveHeroImageField
                value={heroMedia}
                onChange={setHeroMedia}
                t={t}
                folder="hero"
                acceptVideo
              />
              {heroMedia ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setHeroMedia(undefined)}
                >
                  {t("admin.servicePages.clearMedia")}
                </button>
              ) : null}
              <BuilderField
                label={t("admin.servicePages.eyebrow")}
                value={copy.eyebrow}
                onChange={(value) => updateCopy("eyebrow", value)}
                dir={editorDir}
                lang={editLocale}
              />
              <BuilderField
                label={t("admin.servicePages.mainTitle")}
                value={copy.title}
                onChange={(value) => updateCopy("title", value)}
                dir={editorDir}
                lang={editLocale}
              />
              <BuilderField
                label={t("admin.servicePages.body")}
                value={copy.description}
                onChange={(value) => updateCopy("description", value)}
                dir={editorDir}
                lang={editLocale}
                multiline
              />
            </EditorSection>
          );
        }
        if (section.type === "featureGrid") {
          return (
            <EditorSection
              key={section.id}
              icon="text"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              {copy.features.map((feature, index) => (
                <div key={`csp-f-${index}`} className="admin-service-feature">
                  <p>{t("admin.servicePages.featureN", { n: index + 1 })}</p>
                  <BuilderIconPicker
                    label={t("admin.servicePages.featureIcon")}
                    value={feature.icon}
                    fallback={
                      page.template === "contact-lenses"
                        ? CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ?? "shield-check"
                        : EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ?? "eye"
                    }
                    onChange={(icon) => {
                      const next = [...copy.features];
                      next[index] = { ...next[index], icon };
                      updateCopy("features", next);
                    }}
                  />
                  <BuilderField
                    label={t("admin.servicePages.featureTitle")}
                    value={feature.title}
                    onChange={(value) => {
                      const next = [...copy.features];
                      next[index] = { ...next[index], title: value };
                      updateCopy("features", next);
                    }}
                    dir={editorDir}
                    lang={editLocale}
                  />
                  <BuilderField
                    label={t("admin.servicePages.featureDescription")}
                    value={feature.description}
                    onChange={(value) => {
                      const next = [...copy.features];
                      next[index] = { ...next[index], description: value };
                      updateCopy("features", next);
                    }}
                    dir={editorDir}
                    lang={editLocale}
                    multiline
                  />
                </div>
              ))}
            </EditorSection>
          );
        }
        if (section.type === "benefitsList") {
          return (
            <EditorSection
              key={section.id}
              icon="text"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <BuilderField
                label={t("admin.servicePages.benefitsTitle")}
                value={copy.benefitsTitle}
                onChange={(value) => updateCopy("benefitsTitle", value)}
                dir={editorDir}
                lang={editLocale}
              />
              {copy.benefits.map((item, index) => (
                <BuilderField
                  key={`csp-b-${index}`}
                  label={t("admin.servicePages.benefitN", { n: index + 1 })}
                  value={item}
                  onChange={(value) => {
                    const next = [...copy.benefits];
                    next[index] = value;
                    updateCopy("benefits", next);
                  }}
                  dir={editorDir}
                  lang={editLocale}
                  multiline
                />
              ))}
            </EditorSection>
          );
        }
        if (section.type === "notice") {
          return (
            <EditorSection
              key={section.id}
              icon="text"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <BuilderField
                label={t("admin.servicePages.warningTitle")}
                value={copy.warningTitle}
                onChange={(value) => updateCopy("warningTitle", value)}
                dir={editorDir}
                lang={editLocale}
              />
              <BuilderField
                label={t("admin.servicePages.warningText")}
                value={copy.warningText}
                onChange={(value) => updateCopy("warningText", value)}
                dir={editorDir}
                lang={editLocale}
                multiline
              />
            </EditorSection>
          );
        }
        if (section.type === "valuesStrip") {
          return (
            <EditorSection
              key={section.id}
              icon="text"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <BuilderField
                label={t("admin.servicePages.valuesTitle")}
                value={copy.valuesTitle}
                onChange={(value) => updateCopy("valuesTitle", value)}
                dir={editorDir}
                lang={editLocale}
              />
              <BuilderField
                label={t("admin.servicePages.valuesText")}
                value={copy.valuesText}
                onChange={(value) => updateCopy("valuesText", value)}
                dir={editorDir}
                lang={editLocale}
                multiline
              />
              <BuilderField
                label={t("admin.servicePages.privacyText")}
                value={copy.privacyText}
                onChange={(value) => updateCopy("privacyText", value)}
                dir={editorDir}
                lang={editLocale}
                multiline
              />
            </EditorSection>
          );
        }
        if (section.type === "bookingCta") {
          return (
            <EditorSection
              key={section.id}
              icon="buttons"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <p className="admin-muted">{t("admin.servicePages.bookingCtaHint")}</p>
            </EditorSection>
          );
        }
        if (section.type === "products") {
          return (
            <EditorSection
              key={section.id}
              icon="products"
              title={title}
              defaultOpen={wizardMode}
              {...foldProps(section.id)}
            >
              <p className="admin-muted">{t("admin.servicePages.productsHint")}</p>
              <div className="csp-inline-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setProductPickerOpen(true)}
                  disabled={productIds.length >= MAX_PAGE_PRODUCTS}
                >
                  <Package size={16} />
                  {t("admin.servicePages.chooseExistingProduct")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setProductCreateOpen(true)}
                  disabled={productIds.length >= MAX_PAGE_PRODUCTS}
                >
                  <Plus size={16} />
                  {t("admin.servicePages.addNewProduct")}
                </button>
              </div>
              {productIds.length >= MAX_PAGE_PRODUCTS ? (
                <p className="admin-muted">{t("admin.servicePages.productLimit")}</p>
              ) : null}
              <div className="csp-attached-products">
                {attachedProducts.map((product) => (
                  <div key={product.id} className="csp-attached-product">
                    <span className="csp-product-pick-thumb">
                      {product.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.images[0]} alt="" />
                      ) : (
                        <Package size={16} />
                      )}
                    </span>
                    <span className="csp-product-pick-copy">
                      <strong>{product.name}</strong>
                      <small>
                        {product.category} · {formatPrice(product.sellingPrice)}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeProductFromPage(product.id)}
                    >
                      {t("admin.servicePages.removeFromPage")}
                    </button>
                  </div>
                ))}
              </div>
              <p className="admin-muted">{t("admin.servicePages.removeFromPageHint")}</p>
            </EditorSection>
          );
        }
        return null;
      })}
      {!sections.some((section) => section.type === "heroMedia") ? (
        <EditorSection
          icon="text"
          title={t("admin.servicePages.groupText")}
          defaultOpen={wizardMode}
          {...foldProps("page-copy")}
        >
          <BuilderField
            label={t("admin.servicePages.eyebrow")}
            value={copy.eyebrow}
            onChange={(value) => updateCopy("eyebrow", value)}
            dir={editorDir}
            lang={editLocale}
          />
          <BuilderField
            label={t("admin.servicePages.mainTitle")}
            value={copy.title}
            onChange={(value) => updateCopy("title", value)}
            dir={editorDir}
            lang={editLocale}
          />
          <BuilderField
            label={t("admin.servicePages.body")}
            value={copy.description}
            onChange={(value) => updateCopy("description", value)}
            dir={editorDir}
            lang={editLocale}
            multiline
          />
        </EditorSection>
      ) : null}

      <EditorSection
        icon="buttons"
        title={t("admin.servicePages.groupButtons")}
        {...foldProps(
          sections.find((section) => section.type === "bookingCta")?.id ||
            "page-buttons",
        )}
      >
        <div className="admin-service-field">
          <span className="label">{t("admin.servicePages.heroButton")}</span>
          <div
            className="admin-service-langs"
            role="group"
            aria-label={t("admin.servicePages.heroButton")}
          >
            <button
              type="button"
              className={showHeroButton ? "is-active" : ""}
              onClick={() => setShowHeroButton(true)}
            >
              {t("admin.servicePages.showButton")}
            </button>
            <button
              type="button"
              className={!showHeroButton ? "is-active" : ""}
              onClick={() => setShowHeroButton(false)}
            >
              {t("admin.servicePages.hideButton")}
            </button>
          </div>
        </div>
        {buttonVisible ? (
          <>
            <h2>{t("admin.servicePages.pageButton")}</h2>
            <p className="admin-muted">{t("admin.servicePages.pageButtonHint")}</p>
            <BuilderField
              label={t("admin.servicePages.bookingButton")}
              value={copy.bookingButtonText}
              onChange={(value) => updateCopy("bookingButtonText", value)}
              dir={editorDir}
              lang={editLocale}
            />
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.ctaKind")}</span>
              <select
                className="input"
                value={ctaKind}
                onChange={(event) =>
                  setCtaKind(parseCtaKind(event.target.value) || "book")
                }
              >
                <option value="booking">{t("admin.servicePages.ctaKindBooking")}</option>
                <option value="book">{t("admin.servicePages.ctaKindBook")}</option>
                <option value="internal">{t("admin.servicePages.ctaKindInternal")}</option>
                <option value="external">{t("admin.servicePages.ctaKindExternal")}</option>
              </select>
            </label>
            {ctaKind === "booking" ? (
              <label className="admin-service-field">
                <span className="label">{t("admin.servicePages.bookingType")}</span>
                <select
                  className="input"
                  value={bookingType}
                  onChange={(event) => setBookingType(event.target.value)}
                >
                  <option value="">{t("admin.servicePages.bookingTypeNone")}</option>
                  {bookingOptions.map((service) => (
                    <option key={service.key} value={service.key}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {ctaKind === "internal" ? (
              <label className="admin-service-field">
                <span className="label">{t("admin.servicePages.ctaInternal")}</span>
                <select
                  className="input"
                  value={ctaHref}
                  onChange={(event) => setCtaHref(event.target.value)}
                >
                  <option value="">{t("admin.servicePages.ctaInternalChoose")}</option>
                  {PUBLIC_INTERNAL_PATHS.map((path) => (
                    <option key={path} value={path}>
                      {t(INTERNAL_PATH_I18N[path] || path)} ({path})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {ctaKind === "external" ? (
              <BuilderField
                label={t("admin.servicePages.ctaExternal")}
                value={ctaHref}
                onChange={setCtaHref}
                dir="ltr"
              />
            ) : null}
            {ctaKind === "internal" && ctaHref && !sanitizeInternalPath(ctaHref) ? (
              <p className="csp-issues">{t("admin.servicePages.ctaInvalid")}</p>
            ) : null}
            {ctaKind === "external" && ctaHref && !sanitizeExternalUrl(ctaHref) ? (
              <p className="csp-issues">{t("admin.servicePages.ctaInvalid")}</p>
            ) : null}
          </>
        ) : null}
        {sections.some((section) => section.type === "bookingCta" && !section.hidden) ? (
          <>
            <h2>{t("admin.servicePages.sectionBooking")}</h2>
            <p className="admin-muted">{t("admin.servicePages.bookingCtaHint")}</p>
          </>
        ) : null}
      </EditorSection>
      </>
      ) : null}

      {showStep(4) ? (
      <>
      {wizardMode ? (
        <EditorSection
          icon="page"
          title={t("admin.servicePages.wizardStep4")}
          defaultOpen
          {...foldProps("page-review")}
        >
          {!localeComplete ? (
            <>
              <p className="admin-muted">{t("admin.servicePages.wizardReviewMissing")}</p>
              <ul className="csp-issues">
                {issues.map((issue) => (
                  <li key={issue}>{t(ISSUE_I18N[issue])}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="admin-muted">{t("admin.servicePages.wizardReviewReady")}</p>
          )}
          <p className="admin-muted">{t("admin.servicePages.localeHiddenHint")}</p>
        </EditorSection>
      ) : null}
      <EditorSection
        icon="settings"
        title={t("admin.servicePages.groupSettings")}
        {...foldProps("page-settings")}
      >
        <label className="csp-check">
          <input
            type="checkbox"
            checked={showOnHome}
            onChange={(event) => setShowOnHome(event.target.checked)}
          />
          {t("admin.servicePages.showOnHome")}
        </label>
        <BuilderField
          label={t("admin.servicePages.homeSort")}
          value={String(homeSort)}
          onChange={(value) => setHomeSort(Number(value) || 0)}
          dir="ltr"
        />
        <BuilderField
          label={t("admin.servicePages.homeTitle")}
          value={copy.homeTitle}
          onChange={(value) => updateCopy("homeTitle", value)}
          dir={editorDir}
          lang={editLocale}
        />
        <BuilderField
          label={t("admin.servicePages.homeSubtitle")}
          value={copy.homeSubtitle}
          onChange={(value) => updateCopy("homeSubtitle", value)}
          dir={editorDir}
          lang={editLocale}
        />
        <ResponsiveHeroImageField
          value={homeMedia}
          onChange={(media) => {
            setHomeMedia(media);
            setHomeImage(media?.url || "");
          }}
          t={t}
          folder="hero"
          acceptVideo={false}
        />
        {homeMedia ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setHomeMedia(undefined);
              setHomeImage("");
            }}
          >
            {t("admin.servicePages.clearMedia")}
          </button>
        ) : null}
      </EditorSection>
      </>
      ) : null}

      <AdminProductPicker
        open={productPickerOpen}
        t={t}
        selectedIds={productIds}
        remaining={MAX_PAGE_PRODUCTS - productIds.length}
        onClose={() => setProductPickerOpen(false)}
        onPick={attachProducts}
      />
      <AdminProductCreateModal
        open={productCreateOpen}
        t={t}
        onClose={() => setProductCreateOpen(false)}
        onCreated={(product) => attachProducts([product])}
      />
    </div>
  );
}


function BuilderField({
  label,
  value,
  onChange,
  multiline,
  dir,
  lang,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  dir: "ltr" | "rtl";
  lang?: string;
}) {
  const id = label.replace(/\s+/g, "-");
  return (
    <label className="admin-service-field" htmlFor={id}>
      <span className="label">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          className="textarea"
          rows={3}
          dir={dir}
          lang={lang}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          dir={dir}
          lang={lang}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function BuilderIconPicker({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: string;
  fallback: ServiceFeatureIconId;
  onChange: (icon: ServiceFeatureIconId) => void;
}) {
  const selected = pickServiceFeatureIcon(value, fallback);
  return (
    <div className="admin-service-icon-picker">
      <span className="label">{label}</span>
      <div className="admin-service-icon-grid" role="listbox" aria-label={label}>
        {SERVICE_FEATURE_ICON_IDS.map((id) => {
          const Icon = SERVICE_FEATURE_ICONS[id];
          const isSelected = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={isSelected ? "is-selected" : ""}
              onClick={() => onChange(id)}
              title={id}
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
