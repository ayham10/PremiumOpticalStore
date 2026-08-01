"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { apiFetch } from "@/lib/admin-api";
import type { StoreSettings, WorkingHours } from "@/lib/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const EMPTY_SETTINGS: StoreSettings = {
  storeName: "LUMINA",
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
  smtp: {},
  sms: { provider: "console", enabled: true },
  appointmentSlotMinutes: 30,
  bookingLeadDays: 45,
  currency: "ILS",
  currencySymbol: "₪",
};

function normalizeSettings(data: StoreSettings | { settings: StoreSettings }): StoreSettings {
  if (data && typeof data === "object" && "settings" in data) {
    return data.settings;
  }
  return data as StoreSettings;
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
      setForm(normalizeSettings(saved));
      setMessage("Settings saved");
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
      </header>

      {error ? (
        <p className="rounded-xl bg-[#fdeaea] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
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
