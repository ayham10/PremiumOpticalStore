"use client";

import { useCallback, useEffect, useState } from "react";
import { Contact, Eye, RotateCcw, Save } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import { cloneServicePages, mergeServicePages } from "@/lib/service-pages";
import type {
  ContactLensesServicePage,
  EyeExamServicePage,
  ServicePagesSettings,
  StoreSettings,
} from "@/lib/types";

type Tab = "eyeExam" | "contactLenses";

export default function AdminServicePagesPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("eyeExam");
  const [pages, setPages] = useState<ServicePagesSettings>(
    cloneServicePages(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ settings: StoreSettings }>(
        "/api/settings?admin=1",
      );
      setPages(mergeServicePages(data.settings?.servicePages));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.servicePages.loadError"),
      );
      setPages(cloneServicePages());
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

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

  function restoreCurrent() {
    if (!confirm(t("admin.servicePages.restoreConfirm"))) return;
    setPages((prev) => ({
      ...prev,
      [tab]: cloneServicePages()[tab],
    }));
    setMessage(t("admin.servicePages.restored"));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await apiFetch<{ settings: StoreSettings }>(
        "/api/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            settings: { servicePages: mergeServicePages(pages) },
          }),
        },
      );
      setPages(mergeServicePages(saved.settings?.servicePages ?? pages));
      invalidatePublicCache("settings:");
      window.dispatchEvent(new Event("oyon:branding-saved"));
      setMessage(t("admin.servicePages.saved"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.servicePages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  const eye = pages.eyeExam;
  const lenses = pages.contactLenses;

  return (
    <div className="admin-service-pages space-y-5">
      <AdminPageHeader
        icon={Eye}
        kicker={t("admin.servicePages.kicker")}
        title={t("admin.servicePages.title")}
        description={t("admin.servicePages.description")}
      />

      <div className="admin-service-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "eyeExam"}
          className={tab === "eyeExam" ? "is-active" : ""}
          onClick={() => setTab("eyeExam")}
        >
          <Eye size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabEyeExam")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "contactLenses"}
          className={tab === "contactLenses" ? "is-active" : ""}
          onClick={() => setTab("contactLenses")}
        >
          <Contact size={16} strokeWidth={1.6} />
          {t("admin.servicePages.tabContactLenses")}
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
      ) : tab === "eyeExam" ? (
        <div className="admin-service-editor space-y-4">
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
      ) : (
        <div className="admin-service-editor space-y-4">
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
      )}

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
  const id = label.replace(/\s+/g, "-");
  return (
    <label className="admin-service-field" htmlFor={id}>
      <span className="label">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          className="textarea"
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}
