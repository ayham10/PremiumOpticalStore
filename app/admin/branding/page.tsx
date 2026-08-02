"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BrandingSettingsSection from "@/components/admin/BrandingSettingsSection";
import { apiFetch } from "@/lib/admin-api";
import { DEFAULT_BRANDING, mergeBranding } from "@/lib/branding";
import type { StoreSettings } from "@/lib/types";

const EMPTY_SETTINGS: StoreSettings = {
  storeName: "Oyon",
  tagline: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  whatsapp: "",
  googleMapsEmbedUrl: "",
  googleMapsLink: "",
  openingHours: [],
  social: {},
  seo: { title: "", description: "", keywords: "" },
  content: {
    heroTitle: { en: "", ar: "", he: "" },
    heroLine: { en: "", ar: "", he: "" },
    brandSuffix: { en: "", ar: "", he: "" },
  },
  branding: { ...DEFAULT_BRANDING },
  smtp: {},
  sms: { provider: "console", enabled: true },
  appointmentSlotMinutes: 30,
  bookingLeadDays: 45,
  currency: "ILS",
  currencySymbol: "₪",
};

function normalizeSettings(data: StoreSettings | { settings: StoreSettings }): StoreSettings {
  const settings =
    data && typeof data === "object" && "settings" in data
      ? data.settings
      : (data as StoreSettings);
  return {
    ...EMPTY_SETTINGS,
    ...settings,
    branding: mergeBranding(settings.branding),
    content: {
      ...EMPTY_SETTINGS.content,
      ...(settings.content || {}),
    },
    social: { ...EMPTY_SETTINGS.social, ...(settings.social || {}) },
    seo: { ...EMPTY_SETTINGS.seo, ...(settings.seo || {}) },
    sms: { ...EMPTY_SETTINGS.sms, ...(settings.sms || {}) },
  };
}

export default function AdminBrandingPage() {
  const [form, setForm] = useState<StoreSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<StoreSettings | { settings: StoreSettings }>(
        "/api/settings?admin=1",
      );
      setForm(normalizeSettings(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branding");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await apiFetch<StoreSettings | { settings: StoreSettings }>(
        "/api/settings",
        { method: "PUT", body: JSON.stringify({ settings: form }) },
      );
      setForm(normalizeSettings(saved));
      setMessage("Branding saved — applied to website, admin, login, and favicon");
      window.dispatchEvent(new Event("oyon:branding-saved"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--slate)]">Loading branding…</p>;
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        kicker="Website"
        title="Branding"
        description="Edit store name, logo, colors, and typography. Preview updates live; save to apply site-wide."
        actions={
          <Link
            href="/admin/settings"
            className="btn btn-ghost inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Settings
          </Link>
        }
      />

      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <BrandingSettingsSection value={form} onChange={setForm} />
        <div className="sticky bottom-3 z-10 flex justify-end">
          <button type="submit" className="btn btn-accent shadow-lg" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save branding"}
          </button>
        </div>
      </form>
    </div>
  );
}
