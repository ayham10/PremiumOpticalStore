"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  RefreshCw,
  Plus,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { apiFetch } from "@/lib/admin-api";
import type { DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

const GOLD = "#D4AF6A";
const MUTED = "#7A848E";

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

function IconBox({
  icon: Icon,
  tone = "gold",
}: {
  icon: LucideIcon;
  tone?: "gold" | "muted";
}) {
  const isGold = tone === "gold";
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]"
      style={{
        background: isGold ? "rgba(212,175,106,0.10)" : "rgba(255,255,255,0.04)",
        border: isGold
          ? "1px solid rgba(212,175,106,0.28)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: isGold ? "0 0 12px rgba(212,175,106,0.12)" : "none",
        color: isGold ? GOLD : MUTED,
      }}
    >
      <Icon size={15} strokeWidth={1.6} />
    </span>
  );
}

function DashCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-[var(--admin-card,#131a22)] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHead({
  title,
  href,
  action,
  icon,
}: {
  title: string;
  href?: string;
  action?: ReactNode;
  icon: LucideIcon;
}) {
  const titleNode = (
    <div className="flex min-w-0 items-center gap-2">
      <IconBox icon={icon} />
      <h2 className="truncate text-[0.95rem] font-semibold tracking-[-0.02em] text-[#F3F4F5]">
        {title}
      </h2>
    </div>
  );

  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      {href ? (
        <Link href={href} className="min-w-0 no-underline">
          {titleNode}
        </Link>
      ) : (
        titleNode
      )}
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-[0.78rem] font-semibold no-underline"
      style={{ color: GOLD }}
    >
      {children}
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { t, locale } = useLocale();
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
        err instanceof Error ? err.message : t("admin.dashboard.loadError")
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

  const todayHref = useMemo(
    () => `/admin/eye-exam?tab=appointments&date=${todayIsoLocal()}`,
    [],
  );

  if (loading && !stats) {
    return <p className="admin-muted">{t("common.loading")}</p>;
  }

  if ((error && !stats) || !stats) {
    return (
      <DashCard>
        <p className="text-sm text-[var(--danger)]">
          {error || t("admin.dashboard.loadError")}
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-3 inline-flex items-center gap-2"
          onClick={() => void load()}
        >
          <RefreshCw size={15} strokeWidth={1.6} />
          {t("admin.dashboard.refresh")}
        </button>
      </DashCard>
    );
  }

  const schedule = stats.todaysSchedule || [];
  const visibleSchedule = schedule.slice(0, 3);
  const recent = (stats.recentBookings || []).slice(0, 3);
  const todayLabel = new Date().toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const lowStockWarn = stats.lowStockAlerts > 0;

  return (
    <div className="admin-dashboard mx-auto max-w-3xl space-y-3 pb-2">
      <AdminPageHeader
        title={t("admin.dashboard.title")}
        actions={
          <>
            <p
              className="m-0 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[0.78rem] font-medium"
              style={{ color: MUTED }}
            >
              <CalendarDays size={13} strokeWidth={1.6} color={GOLD} />
              {todayLabel}
            </p>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-[rgba(212,175,106,0.35)]"
              onClick={() => void load({ soft: true })}
              disabled={refreshing}
              aria-label={t("admin.dashboard.refresh")}
              style={{ color: MUTED }}
            >
              <RefreshCw
                size={15}
                strokeWidth={1.6}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
            <Link
              href="/admin/eye-exam?tab=appointments&book=1"
              className="btn btn-accent inline-flex h-9 items-center gap-1.5 px-3 text-[0.82rem]"
            >
              <Plus size={15} strokeWidth={1.7} />
              {t("admin.dashboard.newAppointment")}
            </Link>
          </>
        }
      />

      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={todayHref} className="no-underline">
          <DashCard className="h-full !p-3 transition hover:border-[rgba(212,175,106,0.28)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-[0.72rem] font-medium" style={{ color: MUTED }}>
                  {t("admin.dashboard.today")}
                </p>
                <p
                  className="mt-1 text-[1.65rem] font-semibold leading-none tracking-[-0.03em]"
                  style={{ color: GOLD }}
                >
                  {stats.todayAppointments}
                </p>
              </div>
              <IconBox icon={CalendarDays} />
            </div>
          </DashCard>
        </Link>

        <Link href="/admin/inventory" className="no-underline">
          <DashCard className="h-full !p-3 transition hover:border-[rgba(212,175,106,0.28)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="m-0 text-[0.72rem] font-medium" style={{ color: MUTED }}>
                  {t("admin.dashboard.lowStock")}
                </p>
                <p
                  className="mt-1 text-[1.65rem] font-semibold leading-none tracking-[-0.03em]"
                  style={{ color: lowStockWarn ? GOLD : "#F3F4F5" }}
                >
                  {stats.lowStockAlerts}
                </p>
              </div>
              <IconBox
                icon={AlertTriangle}
                tone={lowStockWarn ? "gold" : "muted"}
              />
            </div>
          </DashCard>
        </Link>
      </div>

      <DashCard>
        <PanelHead
          title={t("admin.dashboard.today")}
          href={todayHref}
          icon={Clock3}
          action={<TextLink href={todayHref}>{viewAllTodayLabel(locale)}</TextLink>}
        />

        {visibleSchedule.length ? (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div
              className="grid grid-cols-[3.6rem_minmax(0,1.1fr)_minmax(0,1fr)] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.04em]"
              style={{ color: MUTED }}
            >
              <span>{locale === "ar" ? "الوقت" : locale === "he" ? "שעה" : "Time"}</span>
              <span>{locale === "ar" ? "العميل" : locale === "he" ? "לקוח" : "Customer"}</span>
              <span className="text-end">
                {locale === "ar" ? "الخدمة" : locale === "he" ? "שירות" : "Service"}
              </span>
            </div>
            {visibleSchedule.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[3.6rem_minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-2 border-b border-white/[0.05] px-2.5 py-2 last:border-b-0"
              >
                <p
                  className="m-0 text-[0.82rem] font-semibold tabular-nums"
                  style={{ color: GOLD }}
                >
                  {formatTime(a.startTime, locale)}
                </p>
                <p className="m-0 truncate text-[0.84rem] font-medium text-[#F3F4F5]">
                  {a.customerName}
                </p>
                <p
                  className="m-0 truncate text-end text-[0.78rem]"
                  style={{ color: MUTED }}
                >
                  {serviceLabel(t, a.service)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-4">
            <p className="m-0 text-[0.9rem] font-semibold text-[#F3F4F5]">
              {t("admin.dashboard.emptyToday")}
            </p>
            <p className="mt-1 mb-0 text-[0.8rem] leading-relaxed" style={{ color: MUTED }}>
              {t("admin.dashboard.emptyTodayLead")}
            </p>
          </div>
        )}
      </DashCard>

      <DashCard>
        <PanelHead
          title={t("admin.dashboard.recent")}
          icon={CalendarDays}
          action={
            <TextLink href="/admin/eye-exam?tab=appointments">
              {t("admin.dashboard.viewAll")}
            </TextLink>
          }
        />

        {recent.length ? (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            {recent.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[minmax(0,1.3fr)_auto] items-center gap-3 border-b border-white/[0.05] px-2.5 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-[0.84rem] font-medium text-[#F3F4F5]">
                    {a.customerName}
                  </p>
                  <p className="m-0 truncate text-[0.76rem]" style={{ color: MUTED }}>
                    {serviceLabel(t, a.service)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="m-0 text-[0.78rem] font-medium text-[#E8EAED]">
                    {formatDateLabel(a.date, locale)}
                  </p>
                  <p
                    className="m-0 text-[0.76rem] font-semibold tabular-nums"
                    style={{ color: GOLD }}
                  >
                    {formatTime(a.startTime, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-3 py-3">
            <p className="m-0 text-[0.86rem] font-semibold text-[#F3F4F5]">
              {t("admin.common.noResults")}
            </p>
          </div>
        )}
      </DashCard>

      <section>
        <h2 className="mb-2 m-0 text-[0.95rem] font-semibold tracking-[-0.02em] text-[#F3F4F5]">
          {t("admin.dashboard.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/admin/eye-exam?tab=appointments&book=1"
            className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[var(--admin-card,#131a22)] px-3 py-2.5 no-underline shadow-[0_8px_24px_rgba(0,0,0,0.14)] transition hover:border-[rgba(212,175,106,0.35)]"
          >
            <IconBox icon={Plus} />
            <span className="text-[0.84rem] font-semibold text-[#F3F4F5]">
              {t("admin.dashboard.newAppointment")}
            </span>
          </Link>
          <Link
            href="/admin/eye-exam?tab=availability"
            className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[var(--admin-card,#131a22)] px-3 py-2.5 no-underline shadow-[0_8px_24px_rgba(0,0,0,0.14)] transition hover:border-[rgba(212,175,106,0.35)]"
          >
            <IconBox icon={CalendarRange} tone="muted" />
            <span className="text-[0.84rem] font-semibold text-[#F3F4F5]">
              {t("admin.dashboard.manageAvailability")}
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
