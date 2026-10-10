"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Contact,
  Eye,
  Files,
  Home,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import ResponsiveHeroImageField from "@/components/admin/ResponsiveHeroImageField";
import SectionIdentityFields from "@/components/admin/content-editor/SectionIdentityFields";
import { editorSectionDisplayName } from "@/lib/page-hero-media";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import ContentEditorToolbar from "@/components/admin/content-editor/ContentEditorToolbar";
import ContentEditorWorkspace from "@/components/admin/content-editor/ContentEditorWorkspace";
import EditorSection from "@/components/admin/content-editor/EditorSection";
import { useDebouncedPreviewPayload } from "@/components/admin/content-editor/useDebouncedPreviewPayload";
import CustomPageBuilder, {
  CreateCustomPageModal,
} from "@/components/admin/CustomPageBuilder";
import CustomPagesPanel from "@/components/admin/CustomPagesPanel";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { isRtl, localeLabels, type Locale } from "@/lib/i18n/config";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import { defaultServicePagesForLocale } from "@/lib/service-pages-defaults";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  EYE_EXAM_DEFAULT_FEATURE_ICONS,
  SERVICE_FEATURE_ICON_IDS,
  SERVICE_FEATURE_ICONS,
  pickServiceFeatureIcon,
  type ServiceFeatureIconId,
} from "@/lib/service-page-icons";
import { listCustomPagesForEditor } from "@/lib/custom-service-pages";
import {
  snapshotForDirty,
  viewHrefForEditor,
} from "@/lib/content-editor-preview";
import { BUILT_IN_PREVIEW_SECTION_IDS as PREVIEW_SECTION } from "@/lib/content-editor-sections";
import type { CustomPageProductCard } from "@/components/services/CustomPageProductsCarousel";
import {
  SERVICE_CONTENT_LOCALES,
  cloneLocaleBundle,
  hasHomepageSettings,
  hydrateServicePagesForEditor,
  localePatchPayload,
} from "@/lib/service-pages";
import type {
  CatalogServicePage,
  ContactLensesServicePage,
  CustomPageMediaRef,
  CustomServicePage,
  EyeExamServicePage,
  FooterServiceContent,
  HomepageHeroContent,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
  StoreSettings,
} from "@/lib/types";

type Tab = "homepage" | "eyeExam" | "contactLenses" | "catalog" | "footer";

const ContentFieldLocaleContext = createContext<{
  dir: "ltr" | "rtl";
  lang: ServicePagesLocale;
}>({ dir: "rtl", lang: "ar" });

export default function AdminServicePagesPage() {
  const { t, rtl } = useLocale();
  const { notifySaved } = useAdminSuccessNotice();
  const [tab, setTab] = useState<Tab>("homepage");
  const [editLocale, setEditLocale] = useState<ServicePagesLocale>("ar");
  const editLocaleRef = useRef(editLocale);
  editLocaleRef.current = editLocale;
  const [document, setDocument] = useState<ServicePagesSettings | undefined>();
  const [drafts, setDrafts] = useState<
    Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>>
  >({});
  const [pages, setPages] = useState<ServicePagesLocaleBundle>(
    defaultServicePagesForLocale("ar"),
  );
  const [homepagePersisted, setHomepagePersisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customPageId, setCustomPageId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [myPagesOpen, setMyPagesOpen] = useState(true);
  const [wizardPageId, setWizardPageId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const myPagesRef = useRef<HTMLDivElement | null>(null);
  const [customDraft, setCustomDraft] = useState<{
    page: CustomServicePage;
    products: CustomPageProductCard[];
    dirty: boolean;
  } | null>(null);

  const applyLocale = useCallback(
    (
      incoming: unknown,
      locale: ServicePagesLocale,
      nextDrafts?: Partial<Record<ServicePagesLocale, ServicePagesLocaleBundle>>,
    ) => {
      const draft = nextDrafts?.[locale];
      setPages(
        draft
          ? cloneLocaleBundle(draft)
          : hydrateServicePagesForEditor(
              incoming,
              locale,
              defaultServicePagesForLocale(locale),
            ),
      );
      setHomepagePersisted(hasHomepageSettings(incoming, locale));
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ settings: StoreSettings }>(
        "/api/settings?admin=1",
      );
      const incoming = data.settings?.servicePages;
      const locale = editLocaleRef.current;
      setDocument(incoming);
      setDrafts({});
      applyLocale(incoming, locale, {});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.servicePages.loadError"),
      );
      setDocument(undefined);
      setDrafts({});
      setHomepagePersisted(false);
      setPages(defaultServicePagesForLocale(editLocaleRef.current));
    } finally {
      setLoading(false);
    }
  }, [applyLocale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function switchEditLocale(next: ServicePagesLocale) {
    if (next === editLocale) return;
    const nextDrafts = {
      ...drafts,
      [editLocale]: cloneLocaleBundle(pages),
    };
    setDrafts(nextDrafts);
    setEditLocale(next);
    applyLocale(document, next, nextDrafts);
    setMessage("");
  }

  function updateEyeExam<K extends keyof EyeExamServicePage>(
    key: K,
    value: EyeExamServicePage[K],
  ) {
    setPages((prev) => ({
      ...prev,
      eyeExam: { ...prev.eyeExam, [key]: value },
    }));
  }

  function updateLenses<K extends keyof ContactLensesServicePage>(
    key: K,
    value: ContactLensesServicePage[K],
  ) {
    setPages((prev) => ({
      ...prev,
      contactLenses: { ...prev.contactLenses, [key]: value },
    }));
  }

  function updateHomepageHero<K extends keyof HomepageHeroContent>(
    key: K,
    value: HomepageHeroContent[K],
  ) {
    setPages((prev) => ({
      ...prev,
      homepage: {
        hero: {
          ...(prev.homepage?.hero ??
            defaultServicePagesForLocale(editLocale).homepage!.hero),
          [key]: value,
        },
      },
    }));
  }

  function updateCatalog<K extends keyof CatalogServicePage>(
    key: K,
    value: CatalogServicePage[K],
  ) {
    setPages((prev) => ({
      ...prev,
      catalog: {
        ...(prev.catalog ?? defaultServicePagesForLocale(editLocale).catalog),
        [key]: value,
      },
    }));
  }

  function updateAdminName(sectionId: string, value: string) {
    setPages((prev) => {
      const next = { ...(prev.adminSectionNames || {}) };
      const trimmed = value.trim();
      if (trimmed) next[sectionId] = value;
      else delete next[sectionId];
      return { ...prev, adminSectionNames: next };
    });
  }

  function updateFooter<K extends keyof FooterServiceContent>(
    key: K,
    value: FooterServiceContent[K],
  ) {
    setPages((prev) => ({
      ...prev,
      footer: {
        ...(prev.footer ?? defaultServicePagesForLocale(editLocale).footer!),
        [key]: value,
      },
    }));
  }

  function restoreCurrent() {
    if (!confirm(t("admin.servicePages.restoreConfirm"))) return;
    const original = defaultServicePagesForLocale(editLocale);
    setPages((prev) => ({
      ...prev,
      [tab]: original[tab],
    }));
    setMessage(t("admin.servicePages.restored"));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const includeHomepage = homepagePersisted || tab === "homepage";
      const servicePages = localePatchPayload(editLocale, pages, {
        includeHomepage,
      });
      const saved = await apiFetch<{ settings: StoreSettings }>(
        "/api/settings",
        {
          method: "PUT",
          body: JSON.stringify({ settings: { servicePages } }),
        },
      );
      const next = saved.settings?.servicePages;
      setDocument(next);
      const nextDrafts = {
        ...drafts,
        [editLocale]: cloneLocaleBundle(pages),
      };
      delete nextDrafts[editLocale];
      setDrafts(nextDrafts);
      applyLocale(next ?? document, editLocale, nextDrafts);
      invalidatePublicCache("settings:");
      window.dispatchEvent(new Event("oyon:branding-saved"));
      notifySaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.servicePages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  const home = pages.homepage ?? defaultServicePagesForLocale(editLocale).homepage!;
  const eye = pages.eyeExam;
  const lenses = pages.contactLenses;
  const catalog =
    pages.catalog ?? defaultServicePagesForLocale(editLocale).catalog!;
  const footer = pages.footer ?? defaultServicePagesForLocale(editLocale).footer!;
  const editorDir = isRtl(editLocale as Locale) ? "rtl" : "ltr";

  function adminTitle(sectionId: string, fallback: string) {
    return editorSectionDisplayName(
      pages.adminSectionNames?.[sectionId],
      fallback,
    );
  }

  function renderAdminName(sectionId: string) {
    return (
      <SectionIdentityFields
        adminName={pages.adminSectionNames?.[sectionId] || ""}
        onAdminNameChange={(value) => updateAdminName(sectionId, value)}
        adminLabel={t("admin.servicePages.sectionAdminName")}
        adminHint={t("admin.servicePages.sectionAdminNameHint")}
        dir={editorDir}
        lang={editLocale}
        hideHeading
      />
    );
  }

  function renderHeroMedia(
    value: CustomPageMediaRef | null | undefined,
    onChange: (media?: CustomPageMediaRef) => void,
    acceptVideo: boolean,
  ) {
    return (
      <>
        <h2>{t("admin.servicePages.sectionHero")}</h2>
        <ResponsiveHeroImageField
          value={value || undefined}
          onChange={onChange}
          t={t}
          folder="hero"
          acceptVideo={acceptVideo}
        />
        {value ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange(undefined)}
          >
            {t("admin.servicePages.restoreDefaultMedia")}
          </button>
        ) : null}
      </>
    );
  }

  const customPages = document?.customPages || [];
  const selectedCustom = customPages.find((item) => item.id === customPageId);
  const listedCustom = listCustomPagesForEditor(customPages, pageQuery);
  const savedBundle = hydrateServicePagesForEditor(
    document,
    editLocale,
    defaultServicePagesForLocale(editLocale),
  );
  const builtInDirty = snapshotForDirty(pages) !== snapshotForDirty(savedBundle);
  const previewKind = selectedCustom
    ? "custom"
    : tab;
  const previewPayload = useDebouncedPreviewPayload({
    locale: editLocale,
    kind: previewKind,
    saved: document,
    bundle: pages,
    customPage: customDraft?.page ?? selectedCustom,
    products: customDraft?.products,
    activeSectionId,
  });

  function selectBuiltIn(next: Tab) {
    setCustomPageId(null);
    setCustomDraft(null);
    setWizardPageId(null);
    setActiveSectionId(null);
    setTab(next);
  }

  function selectCustom(page: CustomServicePage, startWizard = false) {
    setCustomPageId(page.id);
    setCustomDraft(null);
    setWizardPageId(startWizard ? page.id : null);
    setActiveSectionId(null);
    setMessage("");
    setError("");
  }

  function showMyPages() {
    setMyPagesOpen(true);
    requestAnimationFrame(() => {
      myPagesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div
      className="admin-service-pages admin-service-pages--visual space-y-5"
      dir={rtl ? "rtl" : "ltr"}
    >
      <AdminPageHeader
        icon={Eye}
        kicker={t("admin.servicePages.kicker")}
        title={t("admin.servicePages.title")}
        description={t("admin.servicePages.description")}
      />

      <div
        className="admin-service-langs"
        role="tablist"
        aria-label={t("admin.servicePages.languages")}
      >
        {SERVICE_CONTENT_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={editLocale === locale}
            className={editLocale === locale ? "is-active" : ""}
            onClick={() => switchEditLocale(locale)}
            dir={isRtl(locale) ? "rtl" : "ltr"}
            lang={locale}
          >
            {localeLabels[locale]}
          </button>
        ))}
      </div>

      <div className="csp-toolbar">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} />
          {t("admin.servicePages.addPage")}
        </button>
        <button
          type="button"
          className={myPagesOpen ? "btn btn-ghost is-active" : "btn btn-ghost"}
          onClick={showMyPages}
        >
          <Files size={16} />
          {t("admin.servicePages.myPages")}
        </button>
        <div className="csp-page-select">
          <Search size={16} aria-hidden />
          <input
            className="input"
            value={pageQuery}
            placeholder={t("admin.servicePages.searchPages")}
            onChange={(event) => {
              setPageQuery(event.target.value);
              setMyPagesOpen(true);
            }}
            onFocus={() => setMyPagesOpen(true)}
            aria-label={t("admin.servicePages.searchPages")}
          />
        </div>
      </div>

      {myPagesOpen ? (
        <div ref={myPagesRef}>
          <CustomPagesPanel
            pages={listedCustom}
            selectedId={customPageId}
            t={t}
            onEdit={selectCustom}
            onCollapse={() => setMyPagesOpen(false)}
          />
        </div>
      ) : null}

      <div className="admin-service-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!selectedCustom && tab === "homepage"}
          className={!selectedCustom && tab === "homepage" ? "is-active" : ""}
          onClick={() => selectBuiltIn("homepage")}
        >
          <Home size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabHome")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!selectedCustom && tab === "eyeExam"}
          className={!selectedCustom && tab === "eyeExam" ? "is-active" : ""}
          onClick={() => selectBuiltIn("eyeExam")}
        >
          <Eye size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabEyeExam")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!selectedCustom && tab === "contactLenses"}
          className={!selectedCustom && tab === "contactLenses" ? "is-active" : ""}
          onClick={() => selectBuiltIn("contactLenses")}
        >
          <Contact size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabContactLenses")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!selectedCustom && tab === "catalog"}
          className={!selectedCustom && tab === "catalog" ? "is-active" : ""}
          onClick={() => selectBuiltIn("catalog")}
        >
          <ShoppingBag size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabCatalog")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!selectedCustom && tab === "footer"}
          className={!selectedCustom && tab === "footer" ? "is-active" : ""}
          onClick={() => selectBuiltIn("footer")}
        >
          <MapPin size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabFooter")}
        </button>
      </div>

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

      {loading ? (
        <p className="admin-muted">{t("admin.servicePages.loading")}</p>
      ) : (
        <ContentEditorWorkspace
          t={t}
          payload={previewPayload}
          editor={
            selectedCustom ? (
              <CustomPageBuilder
                key={selectedCustom.id}
                page={selectedCustom}
                editLocale={editLocale}
                t={t}
                wizardMode={wizardPageId === selectedCustom.id}
                activeSectionId={activeSectionId}
                onActiveSectionChange={setActiveSectionId}
                onDraftChange={setCustomDraft}
                onDocument={(next) => {
                  setDocument(next);
                  invalidatePublicCache("settings:");
                  notifySaved();
                }}
                onDeleted={() => {
                  setCustomPageId(null);
                  setCustomDraft(null);
                  setWizardPageId(null);
                  setActiveSectionId(null);
                  setPageQuery("");
                  notifySaved();
                }}
              />
            ) : (
              <ContentFieldLocaleContext.Provider
                value={{ dir: editorDir, lang: editLocale }}
              >
                <div className="admin-service-editor space-y-4" dir={editorDir} key={`${tab}-${editLocale}`}>
                  <ContentEditorToolbar
                    t={t}
                    saving={saving}
                    dirty={builtInDirty}
                    viewHref={viewHrefForEditor(tab)}
                    onSave={() => void save()}
                    extra={
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={restoreCurrent}
                        disabled={loading || saving}
                      >
                        <RotateCcw size={15} />
                        {t("admin.servicePages.restore")}
                      </button>
                    }
                  />
                  {tab === "homepage" ? (
                    <>
                      <EditorSection
                        icon="text"
                        title={adminTitle(
                          PREVIEW_SECTION.homepageHero,
                          t("admin.servicePages.groupText"),
                        )}
                        sectionId={PREVIEW_SECTION.homepageHero}
                        active={activeSectionId === PREVIEW_SECTION.homepageHero}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.homepageHero)}
                        <Field
                          label={t("admin.servicePages.sectionHeading")}
                          value={home.hero.title}
                          onChange={(value) => updateHomepageHero("title", value)}
                        />
                        <Field
                          label={t("admin.servicePages.subtitle")}
                          value={home.hero.subtitle || ""}
                          onChange={(value) => updateHomepageHero("subtitle", value)}
                        />
                        <h2>{t("admin.servicePages.serviceLabels")}</h2>
                        {home.hero.serviceLabels.map((label, index) => (
                          <Field
                            key={`home-label-${index}`}
                            label={t("admin.servicePages.serviceLabelN", { n: index + 1 })}
                            value={label}
                            onChange={(value) => {
                              const next = [...home.hero.serviceLabels];
                              next[index] = value;
                              updateHomepageHero("serviceLabels", next);
                            }}
                          />
                        ))}
                      </EditorSection>
                      <EditorSection
                        icon="buttons"
                        title={adminTitle(
                          PREVIEW_SECTION.homepageButtons,
                          t("admin.servicePages.groupButtons"),
                        )}
                        sectionId={PREVIEW_SECTION.homepageButtons}
                        active={activeSectionId === PREVIEW_SECTION.homepageButtons}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.homepageButtons)}
                        <Field
                          label={t("admin.servicePages.bookingButton")}
                          value={home.hero.bookingButtonText}
                          onChange={(value) =>
                            updateHomepageHero("bookingButtonText", value)
                          }
                        />
                        <Field
                          label={t("admin.servicePages.shopButton")}
                          value={home.hero.shopButtonText}
                          onChange={(value) => updateHomepageHero("shopButtonText", value)}
                        />
                      </EditorSection>
                    </>
                  ) : tab === "eyeExam" ? (
                    <>
                      <EditorSection
                        icon="hero"
                        title={adminTitle(
                          PREVIEW_SECTION.eyeExamHero,
                          t("admin.servicePages.groupHeroMedia"),
                        )}
                        sectionId={PREVIEW_SECTION.eyeExamHero}
                        active={activeSectionId === PREVIEW_SECTION.eyeExamHero}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.eyeExamHero)}
                        {renderHeroMedia(eye.heroMedia, (media) =>
                          updateEyeExam("heroMedia", media),
                        true)}
                        <Field
                          label={t("admin.servicePages.eyebrow")}
                          value={eye.eyebrow}
                          onChange={(value) => updateEyeExam("eyebrow", value)}
                        />
                        <Field
                          label={t("admin.servicePages.sectionHeading")}
                          value={eye.title}
                          onChange={(value) => updateEyeExam("title", value)}
                        />
                        <Field
                          label={t("admin.servicePages.body")}
                          value={eye.description}
                          onChange={(value) => updateEyeExam("description", value)}
                          multiline
                        />
                      </EditorSection>
                      <EditorSection
                        icon="buttons"
                        title={adminTitle(
                          PREVIEW_SECTION.eyeExamButtons,
                          t("admin.servicePages.groupButtons"),
                        )}
                        sectionId={PREVIEW_SECTION.eyeExamButtons}
                        active={activeSectionId === PREVIEW_SECTION.eyeExamButtons}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.eyeExamButtons)}
                        <Field
                          label={t("admin.servicePages.bookingButton")}
                          value={eye.bookingButtonText}
                          onChange={(value) => updateEyeExam("bookingButtonText", value)}
                        />
                      </EditorSection>
                      <EditorSection
                        icon="text"
                        title={adminTitle(
                          PREVIEW_SECTION.eyeExamFeatures,
                          t("admin.servicePages.features"),
                        )}
                        defaultOpen={false}
                        sectionId={PREVIEW_SECTION.eyeExamFeatures}
                        active={activeSectionId === PREVIEW_SECTION.eyeExamFeatures}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.eyeExamFeatures)}
                        <h2>{t("admin.servicePages.features")}</h2>
                        {eye.features.map((feature, index) => (
                          <div key={`ee-f-${index}`} className="admin-service-feature">
                            <p>{t("admin.servicePages.featureN", { n: index + 1 })}</p>
                            <FeatureIconPicker
                              label={t("admin.servicePages.featureIcon")}
                              value={feature.icon}
                              fallback={EYE_EXAM_DEFAULT_FEATURE_ICONS[index] ?? "eye"}
                              onChange={(icon) => {
                                const next = [...eye.features];
                                next[index] = { ...next[index], icon };
                                updateEyeExam("features", next);
                              }}
                            />
                            <Field
                              label={t("admin.servicePages.featureTitle")}
                              value={feature.title}
                              onChange={(value) => {
                                const next = [...eye.features];
                                next[index] = { ...next[index], title: value };
                                updateEyeExam("features", next);
                              }}
                            />
                            <Field
                              label={t("admin.servicePages.featureDescription")}
                              value={feature.description}
                              onChange={(value) => {
                                const next = [...eye.features];
                                next[index] = { ...next[index], description: value };
                                updateEyeExam("features", next);
                              }}
                            />
                          </div>
                        ))}
                      </EditorSection>
                      <EditorSection
                        icon="text"
                        title={adminTitle(
                          PREVIEW_SECTION.eyeExamBenefits,
                          t("admin.servicePages.benefits"),
                        )}
                        defaultOpen={false}
                        sectionId={PREVIEW_SECTION.eyeExamBenefits}
                        active={activeSectionId === PREVIEW_SECTION.eyeExamBenefits}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.eyeExamBenefits)}
                        <Field
                          label={t("admin.servicePages.sectionHeading")}
                          value={eye.benefitsTitle}
                          onChange={(value) => updateEyeExam("benefitsTitle", value)}
                        />
                        {eye.benefits.map((item, index) => (
                          <Field
                            key={`ee-b-${index}`}
                            label={t("admin.servicePages.benefitN", { n: index + 1 })}
                            value={item}
                            onChange={(value) => {
                              const next = [...eye.benefits];
                              next[index] = value;
                              updateEyeExam("benefits", next);
                            }}
                            multiline
                          />
                        ))}
                      </EditorSection>
                    </>
                  ) : tab === "contactLenses" ? (
                    <>
                      <EditorSection
                        icon="hero"
                        title={adminTitle(
                          PREVIEW_SECTION.contactLensesHero,
                          t("admin.servicePages.groupHeroMedia"),
                        )}
                        sectionId={PREVIEW_SECTION.contactLensesHero}
                        active={activeSectionId === PREVIEW_SECTION.contactLensesHero}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.contactLensesHero)}
                        {renderHeroMedia(lenses.heroMedia, (media) =>
                          updateLenses("heroMedia", media),
                        true)}
                        <Field
                          label={t("admin.servicePages.eyebrow")}
                          value={lenses.eyebrow}
                          onChange={(value) => updateLenses("eyebrow", value)}
                        />
                        <Field
                          label={t("admin.servicePages.sectionHeading")}
                          value={lenses.title}
                          onChange={(value) => updateLenses("title", value)}
                        />
                        <Field
                          label={t("admin.servicePages.body")}
                          value={lenses.description}
                          onChange={(value) => updateLenses("description", value)}
                          multiline
                        />
                      </EditorSection>
                      <EditorSection
                        icon="buttons"
                        title={adminTitle(
                          PREVIEW_SECTION.contactLensesButtons,
                          t("admin.servicePages.groupButtons"),
                        )}
                        sectionId={PREVIEW_SECTION.contactLensesButtons}
                        active={activeSectionId === PREVIEW_SECTION.contactLensesButtons}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.contactLensesButtons)}
                        <Field
                          label={t("admin.servicePages.bookingButton")}
                          value={lenses.bookingButtonText}
                          onChange={(value) => updateLenses("bookingButtonText", value)}
                        />
                      </EditorSection>
                      <EditorSection
                        icon="text"
                        title={adminTitle(
                          PREVIEW_SECTION.contactLensesFeatures,
                          t("admin.servicePages.features"),
                        )}
                        defaultOpen={false}
                        sectionId={PREVIEW_SECTION.contactLensesFeatures}
                        active={activeSectionId === PREVIEW_SECTION.contactLensesFeatures}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.contactLensesFeatures)}
                        <h2>{t("admin.servicePages.features")}</h2>
                        {lenses.features.map((feature, index) => (
                          <div key={`cl-f-${index}`} className="admin-service-feature">
                            <p>{t("admin.servicePages.featureN", { n: index + 1 })}</p>
                            <FeatureIconPicker
                              label={t("admin.servicePages.featureIcon")}
                              value={feature.icon}
                              fallback={
                                CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ?? "shield-check"
                              }
                              onChange={(icon) => {
                                const next = [...lenses.features];
                                next[index] = { ...next[index], icon };
                                updateLenses("features", next);
                              }}
                            />
                            <Field
                              label={t("admin.servicePages.featureTitle")}
                              value={feature.title}
                              onChange={(value) => {
                                const next = [...lenses.features];
                                next[index] = { ...next[index], title: value };
                                updateLenses("features", next);
                              }}
                            />
                            <Field
                              label={t("admin.servicePages.featureDescription")}
                              value={feature.description}
                              onChange={(value) => {
                                const next = [...lenses.features];
                                next[index] = { ...next[index], description: value };
                                updateLenses("features", next);
                              }}
                              multiline
                            />
                          </div>
                        ))}
                      </EditorSection>
                      <EditorSection
                        icon="text"
                        title={adminTitle(
                          PREVIEW_SECTION.contactLensesNotice,
                          t("admin.servicePages.warning"),
                        )}
                        defaultOpen={false}
                        sectionId={PREVIEW_SECTION.contactLensesNotice}
                        active={activeSectionId === PREVIEW_SECTION.contactLensesNotice}
                        onActivate={setActiveSectionId}
                      >
                        {renderAdminName(PREVIEW_SECTION.contactLensesNotice)}
                        <Field
                          label={t("admin.servicePages.warningText")}
                          value={lenses.warningText}
                          onChange={(value) => updateLenses("warningText", value)}
                          multiline
                        />
                      </EditorSection>
                    </>
                  ) : tab === "catalog" ? (
                    <EditorSection
                      icon="hero"
                      title={adminTitle(
                        PREVIEW_SECTION.catalogHero,
                        t("admin.servicePages.sectionHero"),
                      )}
                      sectionId={PREVIEW_SECTION.catalogHero}
                      active={activeSectionId === PREVIEW_SECTION.catalogHero}
                      onActivate={setActiveSectionId}
                    >
                      {renderAdminName(PREVIEW_SECTION.catalogHero)}
                      {renderHeroMedia(catalog.heroMedia, (media) =>
                        updateCatalog("heroMedia", media),
                      false)}
                      <Field
                        label={t("admin.servicePages.sectionHeading")}
                        value={catalog.title || ""}
                        onChange={(value) => updateCatalog("title", value)}
                      />
                      <Field
                        label={t("admin.servicePages.catalogLead")}
                        value={catalog.lead || ""}
                        onChange={(value) => updateCatalog("lead", value)}
                        multiline
                      />
                    </EditorSection>
                  ) : (
                    <EditorSection
                      icon="text"
                      title={adminTitle(
                        PREVIEW_SECTION.footerContent,
                        t("admin.servicePages.groupText"),
                      )}
                      sectionId={PREVIEW_SECTION.footerContent}
                      active={activeSectionId === PREVIEW_SECTION.footerContent}
                      onActivate={setActiveSectionId}
                    >
                      {renderAdminName(PREVIEW_SECTION.footerContent)}
                      <Field
                        label={t("admin.servicePages.tagline")}
                        value={footer.tagline}
                        onChange={(value) => updateFooter("tagline", value)}
                        multiline
                      />
                      <Field
                        label={t("admin.servicePages.hoursLabel")}
                        value={footer.hoursLabel}
                        onChange={(value) => updateFooter("hoursLabel", value)}
                      />
                      <Field
                        label={t("admin.servicePages.locationLabel")}
                        value={footer.locationLabel}
                        onChange={(value) => updateFooter("locationLabel", value)}
                      />
                      <Field
                        label={t("admin.servicePages.address")}
                        value={footer.address}
                        onChange={(value) => updateFooter("address", value)}
                      />
                    </EditorSection>
                  )}
                </div>
              </ContentFieldLocaleContext.Provider>
            )
          }
        />
      )}

      <CreateCustomPageModal
        open={createOpen}
        t={t}
        existingSlugs={(document?.customPages || []).map((page) => page.slug)}
        onClose={() => setCreateOpen(false)}
        onCreated={(page, next) => {
          setDocument(next);
          setMyPagesOpen(false);
          selectCustom(page, true);
          invalidatePublicCache("settings:");
          notifySaved();
        }}
      />
    </div>
  );
}

function FeatureIconPicker({
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
      <div
        className="admin-service-icon-grid"
        role="listbox"
        aria-label={label}
      >
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

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const { dir, lang } = useContext(ContentFieldLocaleContext);
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
