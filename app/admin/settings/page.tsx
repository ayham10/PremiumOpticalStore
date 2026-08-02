"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Palette, Save } from "lucide-react";
import BrandingSettingsSection from "@/components/admin/BrandingSettingsSection";
import { apiFetch } from "@/lib/admin-api";
import { DEFAULT_BRANDING, mergeBranding } from "@/lib/branding";
import type { StoreSettings, WorkingHours } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  openingHours: DAY_NAMES.map((_, day) => ({
    day,
    open: "09:00",
    close: "18:00",
    closed: day === 6,
  })),
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
  };
}

export default function AdminSettingsPage() {
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
        "/api/settings?admin=1"
      );
      setForm(normalizeSettings(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateHours(day: number, patch: Partial<WorkingHours>) {
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h) =>
        h.day === day ? { ...h, ...patch } : h
      ),
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await apiFetch<StoreSettings | { settings: StoreSettings }>(
        "/api/settings",
        { method: "PUT", body: JSON.stringify({ settings: form }) }
      );
      const next = normalizeSettings(saved);
      setForm(next);
      setMessage("Settings saved — branding applied site-wide");
      window.dispatchEvent(new Event("oyon:branding-saved"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-[var(--slate)]">Loading settings…</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="eyebrow">Store</p>
        <h1
          className="mt-1 text-3xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--slate)]">
          Store details, branding, hours, and contact information.
        </p>
      </header>

      <Link
        href="/admin/branding"
        className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[#0B0F14] px-5 py-4 text-white transition hover:border-[#D4AF37]"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#131A22] text-[#D4AF37]">
            <Palette size={20} />
          </span>
          <div>
            <p
              className="text-lg text-[#D4AF37]"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Branding & theme
            </p>
            <p className="text-sm text-[#A7ADB5]">
              Logo, colors, fonts, store name styling
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold text-[#D4AF37]">Open →</span>
      </Link>

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
        <div id="branding">
          <BrandingSettingsSection value={form} onChange={setForm} />
        </div>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Store info
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Store name</label>
              <input
                className="input"
                value={form.storeName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, storeName: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Tagline</label>
              <input
                className="input"
                value={form.tagline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tagline: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">City</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input
                className="input"
                value={form.whatsapp}
                onChange={(e) =>
                  setForm((f) => ({ ...f, whatsapp: e.target.value }))
                }
                placeholder="9725550180"
              />
            </div>
            <div>
              <label className="label">Currency symbol</label>
              <input
                className="input"
                value={form.currencySymbol}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currencySymbol: e.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Maps
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="label">Google Maps embed URL</label>
              <input
                className="input"
                value={form.googleMapsEmbedUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    googleMapsEmbedUrl: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Google Maps link</label>
              <input
                className="input"
                value={form.googleMapsLink}
                onChange={(e) =>
                  setForm((f) => ({ ...f, googleMapsLink: e.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Opening hours
          </h2>
          <div className="space-y-3">
            {form.openingHours.map((h) => (
              <div
                key={h.day}
                className="grid items-center gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:border-0 sm:p-0"
              >
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {DAY_NAMES[h.day]}
                </p>
                <input
                  type="time"
                  className="input"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => updateHours(h.day, { open: e.target.value })}
                />
                <input
                  type="time"
                  className="input"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => updateHours(h.day, { close: e.target.value })}
                />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!h.closed}
                    onChange={(e) =>
                      updateHours(h.day, { closed: e.target.checked })
                    }
                  />
                  Closed
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Social
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["instagram", "facebook", "tiktok", "youtube"] as const).map(
              (key) => (
                <div key={key}>
                  <label className="label capitalize">{key}</label>
                  <input
                    className="input"
                    value={form.social[key] || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        social: { ...f.social, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              )
            )}
          </div>
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Homepage content (EN / AR / HE)
          </h2>
          <p className="text-sm text-[var(--slate)]">
            Leave a field blank to keep the built-in translation for that language.
          </p>
          {(
            [
              ["heroTitle", "Hero title"],
              ["heroLine", "Hero supporting line"],
              ["brandSuffix", "Brand suffix"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2 rounded-xl border border-[var(--line)] p-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["en", "ar", "he"] as const).map((lang) => (
                  <div key={lang}>
                    <label className="label uppercase">{lang}</label>
                    <input
                      className="input"
                      value={form.content?.[key]?.[lang] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          content: {
                            ...f.content,
                            [key]: {
                              ...f.content?.[key],
                              [lang]: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            SEO
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={form.seo.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seo: { ...f.seo, title: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea"
                value={form.seo.description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seo: { ...f.seo, description: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Keywords</label>
              <input
                className="input"
                value={form.seo.keywords}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seo: { ...f.seo, keywords: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </section>

        <section className="admin-card space-y-4 p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            Booking & SMS
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Slot minutes</label>
              <input
                type="number"
                className="input"
                min={5}
                step={5}
                value={form.appointmentSlotMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    appointmentSlotMinutes: Number(e.target.value) || 30,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Booking lead days</label>
              <input
                type="number"
                className="input"
                value={form.bookingLeadDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bookingLeadDays: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">SMS provider</label>
              <select
                className="select"
                value={form.sms.provider}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sms: {
                      ...f.sms,
                      provider: e.target.value as StoreSettings["sms"]["provider"],
                    },
                  }))
                }
              >
                <option value="console">Console (dev)</option>
                <option value="twilio">Twilio</option>
                <option value="messagebird">MessageBird</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="label">SMS from number</label>
              <input
                className="input"
                value={form.sms.fromNumber || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sms: { ...f.sms, fromNumber: e.target.value },
                  }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input
                type="checkbox"
                checked={form.sms.enabled}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sms: { ...f.sms, enabled: e.target.checked },
                  }))
                }
              />
              SMS notifications enabled
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-accent" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
