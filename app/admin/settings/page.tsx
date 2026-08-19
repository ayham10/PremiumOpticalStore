"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  Camera,
  Clock,
  Coins,
  Eye,
  FileText,
  Globe,
  Languages,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Play,
  Plus,
  Save,
  Search,
  Share2,
  SlidersHorizontal,
  Store,
  Tags,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BrandingSettingsSection from "@/components/admin/BrandingSettingsSection";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { minutesToTime, parseTimeToMinutes } from "@/lib/appointments";
import { DEFAULT_BRANDING, mergeBranding } from "@/lib/branding";
import type { DayHoursPeriod, StoreSettings, WorkingHours } from "@/lib/types";
import {
  getDayPeriods,
  MAX_DAY_PERIODS,
  normalizeOpeningHours,
  syncDayHours,
  validateDayPeriods,
} from "@/lib/working-hours";

type SettingsTab =
  | "general"
  | "social"
  | "contact"
  | "hours"
  | "booking"
  | "seo";

const TABS: { id: SettingsTab; labelKey: string; icon: LucideIcon }[] = [
  { id: "general", labelKey: "admin.settings.tabGeneral", icon: SlidersHorizontal },
  { id: "social", labelKey: "admin.settings.tabSocial", icon: Share2 },
  { id: "contact", labelKey: "admin.settings.tabContact", icon: Phone },
  { id: "hours", labelKey: "admin.settings.tabHours", icon: Clock },
  { id: "booking", labelKey: "admin.settings.tabBooking", icon: CalendarDays },
  { id: "seo", labelKey: "admin.settings.tabSeo", icon: Search },
];

const SOCIAL_KEYS = ["instagram", "facebook", "youtube", "tiktok"] as const;

const SOCIAL_ICONS: Record<(typeof SOCIAL_KEYS)[number], LucideIcon> = {
  instagram: Camera,
  facebook: Users,
  youtube: Play,
  tiktok: Music2,
};

function SetLabel({
  htmlFor,
  icon: Icon,
  children,
}: {
  htmlFor?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="label admin-set-label">
      {Icon ? <Icon size={13} strokeWidth={1.7} aria-hidden /> : null}
      {children}
    </label>
  );
}

const CONTENT_FIELDS = [
  ["heroTitle", "admin.settings.heroTitle"],
  ["heroLine", "admin.settings.heroLine"],
  ["brandSuffix", "admin.settings.brandSuffix"],
] as const;

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
  openingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
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
    openingHours: normalizeOpeningHours(
      settings.openingHours?.length
        ? settings.openingHours
        : EMPTY_SETTINGS.openingHours,
    ),
  };
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<p className="admin-muted">…</p>}>
      <AdminSettingsPageInner />
    </Suspense>
  );
}

function AdminSettingsPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<StoreSettings>(EMPTY_SETTINGS);
  const [tab, setTab] = useState<SettingsTab>(() => {
    const raw = searchParams.get("tab");
    const allowed = TABS.map((item) => item.id);
    return allowed.includes(raw as SettingsTab) ? (raw as SettingsTab) : "general";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && TABS.some((item) => item.id === raw)) {
      setTab(raw as SettingsTab);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<StoreSettings | { settings: StoreSettings }>(
        "/api/settings?admin=1"
      );
      setForm(normalizeSettings(data));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.settings.loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateHours(day: number, patch: Partial<WorkingHours>) {
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h) => {
        if (h.day !== day) return h;
        const next = syncDayHours({ ...h, ...patch });
        if (patch.closed === false && !getDayPeriods(next).length) {
          return syncDayHours({
            ...next,
            periods: [{ open: "09:00", close: "18:00" }],
          });
        }
        return next;
      }),
    }));
  }

  function updatePeriod(day: number, index: number, patch: Partial<DayHoursPeriod>) {
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h) => {
        if (h.day !== day) return h;
        const periods = getDayPeriods(h).map((p, i) =>
          i === index ? { ...p, ...patch } : p,
        );
        return syncDayHours({ ...h, periods });
      }),
    }));
  }

  function addPeriod(day: number) {
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h) => {
        if (h.day !== day || h.closed) return h;
        const periods = getDayPeriods(h);
        if (periods.length >= MAX_DAY_PERIODS) return h;
        const last = periods[periods.length - 1];
        const lastClose = parseTimeToMinutes(last.close);
        const breakStart = Math.min(lastClose + 60, 23 * 60 + 30);
        const breakEnd = Math.min(breakStart + 120, 23 * 60 + 59);
        return syncDayHours({
          ...h,
          periods: [
            ...periods,
            {
              open: minutesToTime(breakStart),
              close: minutesToTime(breakEnd),
            },
          ],
        });
      }),
    }));
  }

  function removePeriod(day: number, index: number) {
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h) => {
        if (h.day !== day) return h;
        const periods = getDayPeriods(h).filter((_, i) => i !== index);
        if (!periods.length) return h;
        return syncDayHours({ ...h, periods });
      }),
    }));
  }

  function validateHours(): string | null {
    for (const h of form.openingHours) {
      if (h.closed) continue;
      const code = validateDayPeriods(getDayPeriods(h));
      if (code) {
        const dayLabel = t(`days.${h.day}`);
        const errorKey =
          code === "invalidRange"
            ? "admin.settings.hoursErrorInvalidRange"
            : code === "overlap"
              ? "admin.settings.hoursErrorOverlap"
              : "admin.settings.hoursErrorMaxPeriods";
        return `${dayLabel}: ${t(errorKey)}`;
      }
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hoursError = validateHours();
    if (hoursError) {
      setError(hoursError);
      setMessage("");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await apiFetch<StoreSettings | { settings: StoreSettings }>(
        "/api/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            settings: {
              ...form,
              openingHours: normalizeOpeningHours(form.openingHours),
            },
          }),
        }
      );
      const next = normalizeSettings(saved);
      setForm(next);
      setMessage(t("admin.settings.saved"));
      window.dispatchEvent(new Event("oyon:branding-saved"));
      window.dispatchEvent(new Event("oyon:availability-saved"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.settings.saveError")
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="admin-muted">{t("admin.settings.loading")}</p>;
  }

  return (
    <div className="admin-set space-y-5">
      <AdminPageHeader
        title={t("admin.settings.title")}
        description={t("admin.settings.description")}
        actions={
          <>
            <Link
              href="/"
              target="_blank"
              className="btn btn-ghost inline-flex items-center gap-2"
            >
              <Eye size={16} />
              {t("admin.settings.preview")}
            </Link>
            <button
              type="submit"
              form="admin-settings-form"
              className="btn btn-accent inline-flex items-center gap-2"
              disabled={saving}
            >
              <Save size={16} />
              {saving ? t("admin.settings.saving") : t("admin.settings.save")}
            </button>
          </>
        }
      />

      <nav className="admin-settings-tabs" aria-label={t("admin.settings.title")}>
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`admin-settings-tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={15} strokeWidth={1.7} aria-hidden />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

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

      <form id="admin-settings-form" onSubmit={onSubmit} className="space-y-5">
        {tab === "general" ? (
          <>
            <div id="branding">
              <BrandingSettingsSection value={form} onChange={setForm} />
            </div>

            <section className="admin-card space-y-4 p-5">
              <h2 className="admin-section-title admin-set-title">
                <Store size={16} strokeWidth={1.7} />
                {t("admin.settings.storeInfo")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <SetLabel htmlFor="set-currency" icon={Coins}>
                    {t("admin.settings.currency")}
                  </SetLabel>
                  <input
                    id="set-currency"
                    className="input"
                    value={form.currencySymbol}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        currencySymbol: e.target.value,
                      }))
                    }
                    placeholder={t("admin.settings.currencyIls")}
                  />
                </div>
              </div>
            </section>
          </>
        ) : null}

        {tab === "social" ? (
          <section className="admin-card space-y-4 p-5">
            <h2 className="admin-section-title admin-set-title">
              <Share2 size={16} strokeWidth={1.7} />
              {t("admin.settings.social")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIAL_KEYS.map((key) => {
                const Icon = SOCIAL_ICONS[key];
                return (
                  <div key={key}>
                    <SetLabel htmlFor={`set-social-${key}`} icon={Icon}>
                      <span className="capitalize">{key}</span>
                    </SetLabel>
                    <input
                      id={`set-social-${key}`}
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
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "contact" ? (
          <section className="admin-card space-y-4 p-5">
            <h2 className="admin-section-title admin-set-title">
              <Phone size={16} strokeWidth={1.7} />
              {t("admin.settings.storeInfo")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <SetLabel htmlFor="set-phone" icon={Phone}>
                  {t("admin.settings.phone")}
                </SetLabel>
                <input
                  id="set-phone"
                  className="input"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <SetLabel htmlFor="set-whatsapp" icon={MessageCircle}>
                  {t("admin.settings.whatsapp")}
                </SetLabel>
                <input
                  id="set-whatsapp"
                  className="input"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                  placeholder="9725550180"
                />
              </div>
              <div>
                <SetLabel htmlFor="set-email" icon={Mail}>
                  {t("admin.settings.email")}
                </SetLabel>
                <input
                  id="set-email"
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <SetLabel htmlFor="set-city" icon={Globe}>
                  {t("admin.settings.city")}
                </SetLabel>
                <input
                  id="set-city"
                  className="input"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <SetLabel htmlFor="set-address" icon={MapPin}>
                  {t("admin.settings.address")}
                </SetLabel>
                <input
                  id="set-address"
                  className="input"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <SetLabel htmlFor="set-maps-link" icon={Map}>
                  {t("admin.settings.mapsLink")}
                </SetLabel>
                <input
                  id="set-maps-link"
                  className="input"
                  value={form.googleMapsLink}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      googleMapsLink: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <SetLabel htmlFor="set-maps-embed" icon={Globe}>
                  {t("admin.settings.mapsEmbed")}
                </SetLabel>
                <input
                  id="set-maps-embed"
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
            </div>
          </section>
        ) : null}

        {tab === "hours" ? (
          <section className="admin-card space-y-4 p-5">
            <h2 className="admin-section-title admin-set-title">
              <Clock size={16} strokeWidth={1.7} />
              {t("admin.settings.hours")}
            </h2>
            <div className="admin-set-hours">
              {form.openingHours.map((h) => {
                const periods = h.closed
                  ? [{ open: h.open || "09:00", close: h.close || "18:00" }]
                  : getDayPeriods(h);

                return (
                  <article
                    key={h.day}
                    className={`admin-set-day${h.closed ? " is-closed" : ""}`}
                  >
                    <div className="admin-set-day-name">
                      <Calendar size={15} strokeWidth={1.7} aria-hidden />
                      {t(`days.${h.day}`)}
                    </div>

                    <div className="admin-set-periods">
                      {periods.map((period, index) => (
                        <div
                          key={`${h.day}-${index}`}
                          className="admin-set-period"
                        >
                          <label className="admin-set-time">
                            <span className="admin-set-time-label">
                              {t("admin.settings.from")}
                            </span>
                            <span className="admin-set-timebox">
                              <Clock size={13} strokeWidth={1.7} aria-hidden />
                              <input
                                type="time"
                                className="input"
                                value={period.open}
                                disabled={h.closed}
                                onChange={(e) =>
                                  updatePeriod(h.day, index, {
                                    open: e.target.value,
                                  })
                                }
                              />
                            </span>
                          </label>
                          <label className="admin-set-time">
                            <span className="admin-set-time-label">
                              {t("admin.settings.to")}
                            </span>
                            <span className="admin-set-timebox">
                              <Clock size={13} strokeWidth={1.7} aria-hidden />
                              <input
                                type="time"
                                className="input"
                                value={period.close}
                                disabled={h.closed}
                                onChange={(e) =>
                                  updatePeriod(h.day, index, {
                                    close: e.target.value,
                                  })
                                }
                              />
                            </span>
                          </label>
                          {!h.closed && periods.length > 1 ? (
                            <button
                              type="button"
                              className="admin-hours-remove-period"
                              onClick={() => removePeriod(h.day, index)}
                              aria-label={t("admin.settings.removePeriod")}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          ) : (
                            <span className="admin-set-period-spacer" />
                          )}
                        </div>
                      ))}
                      {!h.closed && periods.length < MAX_DAY_PERIODS ? (
                        <button
                          type="button"
                          className="admin-hours-add-period"
                          onClick={() => addPeriod(h.day)}
                        >
                          <Plus size={14} aria-hidden />
                          {t("admin.settings.addPeriod")}
                        </button>
                      ) : null}
                    </div>

                    <label className="admin-set-switch">
                      <input
                        type="checkbox"
                        checked={!h.closed}
                        onChange={(e) =>
                          updateHours(h.day, { closed: !e.target.checked })
                        }
                      />
                      <span className="admin-set-switch-track" aria-hidden />
                      <span className="admin-set-switch-text">
                        {h.closed
                          ? t("admin.settings.closedLabel")
                          : t("admin.settings.isOpen")}
                      </span>
                    </label>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {tab === "booking" ? (
          <section className="admin-card space-y-4 p-5">
            <h2 className="admin-section-title admin-set-title">
              <CalendarDays size={16} strokeWidth={1.7} />
              {t("admin.settings.bookingSms")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  {t("admin.settings.slotMinutes")}
                </label>
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
                <label className="label">{t("admin.settings.leadDays")}</label>
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
                <label className="label">
                  {t("admin.settings.smsProvider")}
                </label>
                <select
                  className="select"
                  value={form.sms.provider}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sms: {
                        ...f.sms,
                        provider: e.target
                          .value as StoreSettings["sms"]["provider"],
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
                <label className="label">{t("admin.settings.smsFrom")}</label>
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
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2">
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
                {t("admin.settings.smsEnabled")}
              </label>
            </div>
          </section>
        ) : null}

        {tab === "seo" ? (
          <>
            <section className="admin-card space-y-4 p-5">
              <h2 className="admin-section-title admin-set-title">
                <Search size={16} strokeWidth={1.7} />
                {t("admin.settings.tabSeo")}
              </h2>
              <div className="grid gap-4">
                <div>
                  <SetLabel htmlFor="set-seo-title" icon={FileText}>
                    {t("admin.settings.seoTitle")}
                  </SetLabel>
                  <input
                    id="set-seo-title"
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
                  <SetLabel htmlFor="set-seo-desc" icon={FileText}>
                    {t("admin.settings.seoDescription")}
                  </SetLabel>
                  <textarea
                    id="set-seo-desc"
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
                  <SetLabel htmlFor="set-seo-keys" icon={Tags}>
                    {t("admin.settings.seoKeywords")}
                  </SetLabel>
                  <input
                    id="set-seo-keys"
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
              <h2 className="admin-section-title admin-set-title">
                <Languages size={16} strokeWidth={1.7} />
                {t("admin.settings.homepageContent")}
              </h2>
              <p className="admin-muted text-sm">
                {t("admin.settings.homepageHint")}
              </p>
              {CONTENT_FIELDS.map(([key, labelKey]) => (
                <div key={key} className="admin-set-subcard">
                  <p className="admin-set-subtitle">{t(labelKey)}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["en", "ar", "he"] as const).map((lang) => (
                      <div key={lang}>
                        <label className="label admin-set-label uppercase" htmlFor={`set-${key}-${lang}`}>
                          {lang}
                        </label>
                        <input
                          id={`set-${key}-${lang}`}
                          className="input"
                          dir={lang === "en" ? "ltr" : "rtl"}
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
          </>
        ) : null}
      </form>
    </div>
  );
}
