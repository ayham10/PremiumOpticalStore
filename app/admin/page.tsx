"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock3,
  Menu,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import BrandMark from "@/components/branding/BrandMark";
import { useBranding } from "@/components/branding/BrandingProvider";
import { apiFetch } from "@/lib/admin-api";
import type { DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

const GOLD = "#D4AF6A";
const MUTED = "#8A929C";
const PAGE_BG = "#0E1116";
const CARD_BG = "#151A21";
const BORDER = "rgba(255,255,255,0.08)";
const SECTION_GAP = 18;

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  ar: "ar",
  he: "he",
};

function serviceLabel(t: (key: string) => string, service: string): string {
  const key = `clinicBooking.services.${service}`;
  const label = t(key);
  return label === key ? service : label;
}

function formatDateLabel(isoDate: string, locale: Locale): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string, locale: Locale): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(LOCALE_TAGS[locale], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone: string): string {
  const value = (phone || "").trim();
  return value || "—";
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function viewAllTodayLabel(locale: Locale): string {
  if (locale === "ar") return "عرض كل مواعيد اليوم";
  if (locale === "he") return "צפייה בכל תורי היום";
  return "View All Today";
}

function colTime(locale: Locale) {
  if (locale === "ar") return "الوقت";
  if (locale === "he") return "שעה";
  return "Time";
}

function colCustomer(locale: Locale) {
  if (locale === "ar") return "اسم العميل";
  if (locale === "he") return "שם לקוח";
  return "Customer";
}

function colPhone(locale: Locale) {
  if (locale === "ar") return "الهاتف";
  if (locale === "he") return "טלפון";
  return "Phone";
}

function colService(locale: Locale) {
  if (locale === "ar") return "الخدمة";
  if (locale === "he") return "שירות";
  return "Service";
}

function colServiceDate(locale: Locale) {
  if (locale === "ar") return "الخدمة / التاريخ";
  if (locale === "he") return "שירות / תאריך";
  return "Service / Date";
}

function openShellMobileNav() {
  const btn = document.querySelector(
    ".admin-shell .sticky.top-0 button[aria-expanded]",
  ) as HTMLButtonElement | null;
  btn?.click();
}

function IconBox({
  icon: Icon,
  size = 15,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
      style={{
        background: "rgba(212,175,106,0.08)",
        border: "1px solid rgba(212,175,106,0.28)",
        boxShadow: "0 0 10px rgba(212,175,106,0.10)",
        color: GOLD,
      }}
    >
      <Icon size={size} strokeWidth={1.55} />
    </span>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
      }}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        paddingBottom: 14,
        marginBottom: 0,
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <IconBox icon={icon} size={14} />
        <h2
          className="m-0 truncate text-[1rem] font-semibold tracking-[-0.02em]"
          style={{ color: "#F5F6F7" }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { t, locale } = useLocale();
  const { branding } = useBranding();
  const [stats, setStats] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await apiFetch<
        DashboardPayload | { stats: DashboardPayload }
      >("/api/dashboard");
      const next = "stats" in data ? data.stats : data;
      setStats(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.dashboard.loadError"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onFocus() {
      void load({ soft: true });
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void load({ soft: true });
      }
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const bar = document.querySelector(
      ".admin-shell .sticky.top-0.md\\:hidden, .admin-shell .sticky.top-0",
    ) as HTMLElement | null;
    if (!bar || window.matchMedia("(min-width: 768px)").matches) return;
    const prev = bar.style.display;
    bar.style.display = "none";
    return () => {
      bar.style.display = prev;
    };
  }, []);

  const todayHref = useMemo(
    () => `/admin/eye-exam?tab=appointments&date=${todayIsoLocal()}`,
    [],
  );

  const todayLabel = new Date().toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (loading && !stats) {
    return (
      <div style={{ background: PAGE_BG, padding: 16, color: MUTED }}>
        {t("common.loading")}
      </div>
    );
  }

  if ((error && !stats) || !stats) {
    return (
      <div style={{ background: PAGE_BG, padding: 16 }}>
        <Card>
          <p style={{ color: "var(--danger)", margin: 0 }}>
            {error || t("admin.dashboard.loadError")}
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-3 inline-flex items-center gap-2"
            onClick={() => void load()}
          >
            <RefreshCw size={15} strokeWidth={1.55} />
            {t("admin.dashboard.refresh")}
          </button>
        </Card>
      </div>
    );
  }

  const schedule = (stats.todaysSchedule || []).slice(0, 3);
  const recent = (stats.recentBookings || []).slice(0, 3);

  return (
    <div
      className="admin-dashboard"
      style={{
        margin: "-1.15rem",
        marginBottom: "calc(-1.5rem - env(safe-area-inset-bottom, 0px))",
        minHeight: "100%",
        background: PAGE_BG,
        padding: 16,
        paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        flexDirection: "column",
        gap: SECTION_GAP,
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <BrandMark branding={branding} href="/admin" size="sm" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={locale === "ar" ? "الإشعارات" : "Notifications"}
            className="grid h-10 w-10 place-items-center rounded-[10px]"
            style={{
              border: "1px solid rgba(212,175,106,0.45)",
              background: "rgba(212,175,106,0.06)",
              color: GOLD,
            }}
          >
            <Bell size={16} strokeWidth={1.55} />
          </button>
          <button
            type="button"
            aria-label={t("nav.menu")}
            onClick={openShellMobileNav}
            className="grid h-10 w-10 place-items-center rounded-[10px]"
            style={{
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.03)",
              color: "#E8EAED",
            }}
          >
            <Menu size={17} strokeWidth={1.55} />
          </button>
        </div>
      </header>

      <div>
        <h1
          className="m-0 text-[1.55rem] font-semibold tracking-[-0.03em]"
          style={{ color: "#F5F6F7" }}
        >
          {t("admin.dashboard.title")}
        </h1>
        <p
          className="mt-1 mb-0 text-[0.86rem] leading-relaxed"
          style={{ color: MUTED }}
        >
          {t("admin.dashboard.description")}
        </p>
      </div>

      {error ? (
        <p
          className="m-0 rounded-[14px] px-3 py-2 text-sm"
          style={{
            border: "1px solid rgba(224,122,122,0.35)",
            background: "rgba(224,122,122,0.12)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      {/* TOP ACTIONS */}
      <div className="flex items-center gap-2.5">
        <div
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] px-3 text-[0.84rem] font-medium"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${BORDER}`,
            color: "#E8EAED",
          }}
        >
          <CalendarDays size={15} strokeWidth={1.55} color={GOLD} />
          <span className="max-w-[8.5rem] truncate">{todayLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => void load({ soft: true })}
          disabled={refreshing}
          aria-label={t("admin.dashboard.refresh")}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] px-3 text-[0.84rem] font-medium disabled:opacity-60"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${BORDER}`,
            color: "#E8EAED",
          }}
        >
          <RefreshCw
            size={15}
            strokeWidth={1.55}
            color={MUTED}
            className={refreshing ? "animate-spin" : ""}
          />
          <span>{t("admin.dashboard.refresh")}</span>
        </button>

        <Link
          href="/admin/eye-exam?tab=appointments&book=1"
          className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[0.86rem] font-semibold no-underline"
          style={{
            background: "rgba(212,175,106,0.14)",
            border: "1px solid rgba(212,175,106,0.55)",
            color: GOLD,
            boxShadow: "0 0 16px rgba(212,175,106,0.12)",
          }}
        >
          <Plus size={15} strokeWidth={1.7} />
          <span className="truncate">{t("admin.dashboard.newAppointment")}</span>
        </Link>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={todayHref} className="no-underline">
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 16,
              height: "100%",
              boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            }}
          >
            <IconBox icon={CalendarDays} />
            <p
              className="mb-0 mt-3 text-[1.7rem] font-semibold leading-none tracking-[-0.03em]"
              style={{ color: GOLD }}
            >
              {stats.todayAppointments}
            </p>
            <p
              className="mb-0 mt-2 text-[0.82rem] font-medium"
              style={{ color: "#F0F1F2" }}
            >
              {t("admin.dashboard.today")}
            </p>
            <p
              className="mb-0 mt-1.5 text-[0.78rem] font-semibold"
              style={{ color: GOLD }}
            >
              {t("admin.dashboard.todayHint")}
            </p>
          </div>
        </Link>

        <Link href="/admin/inventory" className="no-underline">
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: 16,
              height: "100%",
              boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            }}
          >
            <IconBox icon={AlertTriangle} />
            <p
              className="mb-0 mt-3 text-[1.7rem] font-semibold leading-none tracking-[-0.03em]"
              style={{ color: GOLD }}
            >
              {stats.lowStockAlerts}
            </p>
            <p
              className="mb-0 mt-2 text-[0.82rem] font-medium"
              style={{ color: "#F0F1F2" }}
            >
              {t("admin.dashboard.lowStock")}
            </p>
            <p
              className="mb-0 mt-1.5 text-[0.78rem] font-semibold"
              style={{ color: GOLD }}
            >
              {t("admin.dashboard.lowStockHint")}
            </p>
          </div>
        </Link>
      </div>

      {/* TODAY'S APPOINTMENTS */}
      <Card>
        <SectionHeader
          title={t("admin.dashboard.today")}
          icon={Clock3}
          action={
            <Link
              href={todayHref}
              className="shrink-0 text-[0.78rem] font-semibold no-underline"
              style={{ color: GOLD }}
            >
              {viewAllTodayLabel(locale)}
            </Link>
          }
        />

        {schedule.length ? (
          <div style={{ paddingTop: 12 }}>
            <div
              className="grid grid-cols-[4.25rem_minmax(0,1.2fr)_minmax(0,1fr)] gap-2 pb-2.5 text-[0.72rem] font-medium"
              style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}
            >
              <span>{colTime(locale)}</span>
              <span>{colCustomer(locale)}</span>
              <span className="text-end">{colService(locale)}</span>
            </div>
            {schedule.map((a, index) => (
              <div
                key={a.id}
                className="grid grid-cols-[4.25rem_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-2 py-3"
                style={{
                  borderBottom:
                    index < schedule.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <p
                  className="m-0 text-[0.84rem] font-semibold tabular-nums"
                  style={{ color: GOLD }}
                >
                  {formatTime(a.startTime, locale)}
                </p>
                <p
                  className="m-0 truncate text-[0.86rem] font-medium"
                  style={{ color: "#F0F1F2" }}
                >
                  {a.customerName}
                </p>
                <p
                  className="m-0 truncate text-end text-[0.8rem]"
                  style={{ color: MUTED }}
                >
                  {serviceLabel(t, a.service)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-3 rounded-[12px] px-3 py-4"
            style={{ border: `1px dashed ${BORDER}` }}
          >
            <p className="m-0 text-[0.9rem] font-semibold" style={{ color: "#F0F1F2" }}>
              {t("admin.dashboard.emptyToday")}
            </p>
            <p className="mb-0 mt-1 text-[0.8rem] leading-relaxed" style={{ color: MUTED }}>
              {t("admin.dashboard.emptyTodayLead")}
            </p>
          </div>
        )}
      </Card>

      {/* RECENT BOOKINGS */}
      <Card>
        <SectionHeader
          title={t("admin.dashboard.recent")}
          icon={CalendarDays}
          action={
            <Link
              href="/admin/eye-exam?tab=appointments"
              className="shrink-0 text-[0.78rem] font-semibold no-underline"
              style={{ color: GOLD }}
            >
              {t("admin.dashboard.viewAll")}
            </Link>
          }
        />

        {recent.length ? (
          <div style={{ paddingTop: 12 }}>
            <div
              className="grid grid-cols-[3.9rem_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,1fr)] gap-1.5 pb-2.5 text-[0.68rem] font-medium"
              style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}
            >
              <span>{colTime(locale)}</span>
              <span>{colCustomer(locale)}</span>
              <span>{colPhone(locale)}</span>
              <span className="text-end">{colServiceDate(locale)}</span>
            </div>
            {recent.map((a, index) => (
              <div
                key={a.id}
                className="grid grid-cols-[3.9rem_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,1fr)] items-center gap-1.5 py-3"
                style={{
                  borderBottom:
                    index < recent.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                <p
                  className="m-0 text-[0.8rem] font-semibold tabular-nums"
                  style={{ color: GOLD }}
                >
                  {formatTime(a.startTime, locale)}
                </p>
                <p
                  className="m-0 truncate text-[0.82rem] font-medium"
                  style={{ color: "#F0F1F2" }}
                >
                  {a.customerName}
                </p>
                <p
                  className="m-0 truncate text-[0.76rem] tabular-nums"
                  style={{ color: MUTED }}
                  dir="ltr"
                >
                  {formatPhone(a.customerPhone)}
                </p>
                <div className="min-w-0 text-end">
                  <p
                    className="m-0 truncate text-[0.78rem] font-medium"
                    style={{ color: "#E8EAED" }}
                  >
                    {serviceLabel(t, a.service)}
                  </p>
                  <p className="m-0 truncate text-[0.72rem]" style={{ color: MUTED }}>
                    {formatDateLabel(a.date, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-3 rounded-[12px] px-3 py-3"
            style={{ border: `1px dashed ${BORDER}` }}
          >
            <p className="m-0 text-[0.86rem] font-semibold" style={{ color: "#F0F1F2" }}>
              {t("admin.common.noResults")}
            </p>
          </div>
        )}
      </Card>

      {/* QUICK ACTIONS */}
      <Card>
        <div
          style={{
            paddingBottom: 14,
            borderBottom: `1px solid ${BORDER}`,
            marginBottom: 14,
          }}
        >
          <h2
            className="m-0 text-[1rem] font-semibold tracking-[-0.02em]"
            style={{ color: "#F5F6F7" }}
          >
            {t("admin.dashboard.quickActions")}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/eye-exam?tab=appointments&book=1"
            className="flex min-h-[72px] items-center gap-2.5 rounded-[14px] px-3 py-3.5 no-underline"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <IconBox icon={Plus} size={14} />
            <span
              className="text-[0.84rem] font-semibold leading-snug"
              style={{ color: "#F0F1F2" }}
            >
              {t("admin.dashboard.newAppointment")}
            </span>
          </Link>
          <Link
            href="/admin/eye-exam?tab=availability"
            className="flex min-h-[72px] items-center gap-2.5 rounded-[14px] px-3 py-3.5 no-underline"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: `1px solid ${BORDER}`,
            }}
          >
            <IconBox icon={Clock3} size={14} />
            <span
              className="text-[0.84rem] font-semibold leading-snug"
              style={{ color: "#F0F1F2" }}
            >
              {t("admin.dashboard.manageAvailability")}
            </span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
