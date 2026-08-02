"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Package,
  AlertTriangle,
  RefreshCw,
  Plus,
  Tag,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatCard from "@/components/admin/StatCard";
import { apiFetch } from "@/lib/admin-api";
import type { DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

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

function statusLabel(t: (key: string) => string, status: string): string {
  const map: Record<string, string> = {
    pending: "admin.dashboard.statusPending",
    confirmed: "admin.dashboard.statusConfirmed",
    completed: "admin.dashboard.statusCompleted",
    cancelled: "admin.dashboard.statusCancelled",
    "no-show": "admin.dashboard.statusNoShow",
    no_show: "admin.dashboard.statusNoShow",
  };
  const key = map[status];
  if (!key) return status;
  const label = t(key);
  return label === key ? status : label;
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

  if (loading && !stats) {
    return <p className="admin-muted">{t("common.loading")}</p>;
  }

  if ((error && !stats) || !stats) {
    return (
      <div className="admin-card space-y-3">
        <p className="text-[var(--danger)]">
          {error || t("admin.dashboard.loadError")}
        </p>
        <button
          type="button"
          className="btn btn-ghost inline-flex items-center gap-2"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          {t("admin.dashboard.refresh")}
        </button>
      </div>
    );
  }

  const schedule = stats.todaysSchedule || [];
  const recent = (stats.recentBookings || []).slice(0, 5);
  const todayLabel = new Date().toLocaleDateString(LOCALE_TAGS[locale], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="admin-dashboard space-y-5 md:space-y-6">
      <AdminPageHeader
        kicker={t("admin.dashboard.overview")}
        title={t("admin.dashboard.welcome")}
        description={t("admin.dashboard.description")}
        actions={
          <>
            <p className="admin-dashboard-date">{todayLabel}</p>
            <button
              type="button"
              className="btn btn-ghost inline-flex items-center gap-2"
              onClick={() => void load({ soft: true })}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              {t("admin.dashboard.refresh")}
            </button>
            <Link
              href="/admin/eye-exam?tab=appointments&book=1"
              className="btn btn-accent inline-flex items-center gap-2"
            >
              <Plus size={16} />
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 sm:gap-4">
        <StatCard
          label={t("admin.dashboard.today")}
          value={stats.todayAppointments}
          hint={t("admin.dashboard.todayHint")}
          href="/admin/eye-exam?tab=appointments"
          icon={CalendarDays}
        />
        <StatCard
          label={t("admin.dashboard.customers")}
          value={stats.totalCustomers}
          icon={Users}
        />
        <StatCard
          label={t("admin.dashboard.lowStock")}
          value={stats.lowStockAlerts}
          hint={t("admin.dashboard.lowStockHint")}
          href="/admin/inventory"
          icon={AlertTriangle}
          tone={stats.lowStockAlerts > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="admin-card admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <h2 className="admin-section-title">{t("admin.dashboard.today")}</h2>
            {schedule.length ? (
              <Link
                href="/admin/eye-exam?tab=appointments"
                className="admin-dashboard-link"
              >
                {t("admin.dashboard.viewAll")}
              </Link>
            ) : null}
          </div>

          {schedule.length ? (
            <div className="admin-dashboard-list">
              {schedule.map((a) => (
                <div key={a.id} className="admin-schedule-row">
                  <p className="admin-dashboard-time">
                    {formatTime(a.startTime, locale)}
                  </p>
                  <div className="min-w-0">
                    <p className="admin-cell-primary truncate">
                      {a.customerName}
                    </p>
                    <p className="admin-cell-secondary truncate">
                      {serviceLabel(t, a.service)}
                    </p>
                  </div>
                  <span className={`status status-${a.status}`}>
                    {statusLabel(t, a.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-dashboard-empty">
              <p className="admin-dashboard-empty-title">
                {t("admin.dashboard.emptyToday")}
              </p>
              <p className="admin-dashboard-empty-lead">
                {t("admin.dashboard.emptyTodayLead")}
              </p>
              <div className="admin-dashboard-empty-actions">
                <Link
                  href="/admin/eye-exam?tab=appointments&book=1"
                  className="btn btn-accent inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  {t("admin.dashboard.newAppointment")}
                </Link>
                <Link
                  href="/admin/eye-exam?tab=availability"
                  className="btn btn-ghost inline-flex items-center gap-2"
                >
                  <CalendarRange size={16} />
                  {t("admin.dashboard.manageAvailability")}
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="admin-card admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <h2 className="admin-section-title">
              {t("admin.dashboard.recent")}
            </h2>
            <Link
              href="/admin/eye-exam?tab=appointments"
              className="admin-dashboard-link"
            >
              {t("admin.dashboard.viewAll")}
            </Link>
          </div>

          {recent.length ? (
            <div className="admin-dashboard-list">
              {recent.map((a) => (
                <div key={a.id} className="admin-schedule-row admin-recent-row">
                  <div className="min-w-0">
                    <p className="admin-cell-primary truncate">
                      {a.customerName}
                    </p>
                    <p className="admin-cell-secondary truncate">
                      {serviceLabel(t, a.service)}
                    </p>
                  </div>
                  <div className="admin-dashboard-meta">
                    <p className="admin-cell-primary text-sm font-semibold">
                      {formatDateLabel(a.date, locale)}
                    </p>
                    <p className="admin-cell-secondary">
                      {formatTime(a.startTime, locale)}
                    </p>
                  </div>
                  <span className={`status status-${a.status}`}>
                    {statusLabel(t, a.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-dashboard-empty admin-dashboard-empty--compact">
              <p className="admin-dashboard-empty-title">
                {t("admin.common.noResults")}
              </p>
            </div>
          )}
        </section>
      </div>

      <section>
        <h2 className="admin-section-title mb-3">
          {t("admin.dashboard.quickActions")}
        </h2>
        <div className="admin-quick-actions-grid">
          <Link
            href="/admin/eye-exam?tab=appointments&book=1"
            className="admin-quick-action"
          >
            <span className="admin-quick-action-icon">
              <Plus size={18} />
            </span>
            <span className="admin-quick-action-label">
              {t("admin.dashboard.newAppointment")}
            </span>
          </Link>
          <Link
            href="/admin/eye-exam?tab=availability"
            className="admin-quick-action"
          >
            <span className="admin-quick-action-icon">
              <CalendarRange size={18} />
            </span>
            <span className="admin-quick-action-label">
              {t("admin.dashboard.manageAvailability")}
            </span>
          </Link>
          <Link href="/admin/inventory" className="admin-quick-action">
            <span className="admin-quick-action-icon">
              <Package size={18} />
            </span>
            <span className="admin-quick-action-label">
              {t("admin.dashboard.products")}
            </span>
          </Link>
          <Link href="/admin/promotions" className="admin-quick-action">
            <span className="admin-quick-action-icon">
              <Tag size={18} />
            </span>
            <span className="admin-quick-action-label">
              {t("admin.dashboard.offers")}
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
