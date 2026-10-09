"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Contact, Eye, Home, MapPin, Plus, RotateCcw, Save, Search } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import CustomPageBuilder, {
  CreateCustomPageModal,
} from "@/components/admin/CustomPageBuilder";
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
import {
  SERVICE_CONTENT_LOCALES,
  cloneLocaleBundle,
  hasHomepageSettings,
  hydrateServicePagesForEditor,
  localePatchPayload,
} from "@/lib/service-pages";
import type {
  ContactLensesServicePage,
  CustomServicePage,
  EyeExamServicePage,
  FooterServiceContent,
  HomepageHeroContent,
  ServicePagesLocale,
  ServicePagesLocaleBundle,
  ServicePagesSettings,
  StoreSettings,
} from "@/lib/types";

type Tab = "homepage" | "eyeExam" | "contactLenses" | "footer";

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
  const [pageMenuOpen, setPageMenuOpen] = useState(false);

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
  const footer = pages.footer ?? defaultServicePagesForLocale(editLocale).footer!;
  const editorDir = isRtl(editLocale as Locale) ? "rtl" : "ltr";
  const customPages = document?.customPages || [];
  const selectedCustom = customPages.find((item) => item.id === customPageId);
  const filteredCustom = customPages.filter((item) => {
    const q = pageQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q)
    );
  });

  function selectBuiltIn(next: Tab) {
    setCustomPageId(null);
    setPageMenuOpen(false);
    setTab(next);
  }

  function selectCustom(page: CustomServicePage) {
    setCustomPageId(page.id);
    setPageQuery(page.name);
    setPageMenuOpen(false);
    setMessage("");
    setError("");
  }

  return (
    <div
      className="admin-service-pages space-y-5"
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
        <div className="csp-page-select">
          <Search size={16} aria-hidden />
          <input
            className="input"
            value={pageQuery}
            placeholder={t("admin.servicePages.searchPages")}
            onChange={(event) => {
              setPageQuery(event.target.value);
              setPageMenuOpen(true);
            }}
            onFocus={() => setPageMenuOpen(true)}
            aria-label={t("admin.servicePages.searchPages")}
          />
          {pageMenuOpen ? (
            <ul className="csp-page-menu" role="listbox">
              {filteredCustom.length === 0 ? (
                <li className="is-empty">{t("admin.servicePages.noPages")}</li>
              ) : (
                filteredCustom.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === customPageId}
                      onClick={() => selectCustom(item)}
                    >
                      <span>{item.name}</span>
                      <small>/services/{item.slug}</small>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>

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
      ) : selectedCustom ? (
        <CustomPageBuilder
          key={selectedCustom.id}
          page={selectedCustom}
          editLocale={editLocale}
          t={t}
          onDocument={(next) => {
            setDocument(next);
            invalidatePublicCache("settings:");
            notifySaved();
          }}
          onDeleted={() => {
            setCustomPageId(null);
            setPageQuery("");
            notifySaved();
          }}
        />
      ) : (
      <ContentFieldLocaleContext.Provider
        value={{ dir: editorDir, lang: editLocale }}
      >
      {tab === "homepage" ? (
        <div className="admin-service-editor space-y-4" dir={editorDir}>
          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.hero")}</h2>
            <Field
              label={t("admin.servicePages.mainTitle")}
              value={home.hero.title}
              onChange={(value) => updateHomepageHero("title", value)}
            />
            <Field
              label={t("admin.servicePages.subtitle")}
              value={home.hero.subtitle || ""}
              onChange={(value) => updateHomepageHero("subtitle", value)}
            />
          </section>

          <section className="admin-card admin-service-card">
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
          </section>

          <section className="admin-card admin-service-card">
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
          </section>
        </div>
      ) : tab === "eyeExam" ? (
        <div className="admin-service-editor space-y-4" dir={editorDir}>
          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.hero")}</h2>
            <Field
              label={t("admin.servicePages.eyebrow")}
              value={eye.eyebrow}
              onChange={(value) => updateEyeExam("eyebrow", value)}
            />
            <Field
              label={t("admin.servicePages.mainTitle")}
              value={eye.title}
              onChange={(value) => updateEyeExam("title", value)}
            />
            <Field
              label={t("admin.servicePages.body")}
              value={eye.description}
              onChange={(value) => updateEyeExam("description", value)}
              multiline
            />
            <Field
              label={t("admin.servicePages.bookingButton")}
              value={eye.bookingButtonText}
              onChange={(value) => updateEyeExam("bookingButtonText", value)}
            />
          </section>

          <section className="admin-card admin-service-card">
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
          </section>

          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.benefits")}</h2>
            <Field
              label={t("admin.servicePages.benefitsTitle")}
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
          </section>
        </div>
      ) : tab === "contactLenses" ? (
        <div className="admin-service-editor space-y-4" dir={editorDir}>
          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.hero")}</h2>
            <Field
              label={t("admin.servicePages.eyebrow")}
              value={lenses.eyebrow}
              onChange={(value) => updateLenses("eyebrow", value)}
            />
            <Field
              label={t("admin.servicePages.mainTitle")}
              value={lenses.title}
              onChange={(value) => updateLenses("title", value)}
            />
            <Field
              label={t("admin.servicePages.body")}
              value={lenses.description}
              onChange={(value) => updateLenses("description", value)}
              multiline
            />
            <Field
              label={t("admin.servicePages.bookingButton")}
              value={lenses.bookingButtonText}
              onChange={(value) => updateLenses("bookingButtonText", value)}
            />
          </section>

          <section className="admin-card admin-service-card">
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
          </section>

          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.warning")}</h2>
            <Field
              label={t("admin.servicePages.warningText")}
              value={lenses.warningText}
              onChange={(value) => updateLenses("warningText", value)}
              multiline
            />
          </section>
        </div>
      ) : (
        <div className="admin-service-editor space-y-4" dir={editorDir}>
          <section className="admin-card admin-service-card">
            <h2>{t("admin.servicePages.tabFooter")}</h2>
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
          </section>
        </div>
      )}
      </ContentFieldLocaleContext.Provider>
      )}

      {selectedCustom ? null : (
      <div className="admin-service-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={restoreCurrent}
          disabled={loading || saving}
        >
          <RotateCcw size={16} />
          {t("admin.servicePages.restore")}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void save()}
          disabled={loading || saving}
        >
          <Save size={16} />
          {saving ? t("admin.servicePages.saving") : t("admin.servicePages.save")}
        </button>
      </div>
      )}

      <CreateCustomPageModal
        open={createOpen}
        t={t}
        onClose={() => setCreateOpen(false)}
        onCreated={(page, next) => {
          setDocument(next);
          selectCustom(page);
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
