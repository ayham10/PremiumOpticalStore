"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Package,
  AlertTriangle,
  RefreshCw,
  Plus,
  Clock3,
  Tag,
  Glasses,
  Users,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import StatCard from "@/components/admin/StatCard";
import { apiFetch } from "@/lib/admin-api";
import type { DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

function serviceLabel(t: (key: string) => string, service: string): string {
  const key = `clinicBooking.services.${service}`;
  const label = t(key);
  return label === key ? service : label;
}

function relativeCreated(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";
  const diffMin = Math.round((Date.now() - created) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) {
    return `Today, ${new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return new Date(iso).toLocaleDateString();
}

export default function AdminDashboardPage() {
  const { t } = useLocale();
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
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const upcomingCount = useMemo(() => {
    if (!stats?.appointmentsByDay?.length) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return stats.appointmentsByDay
      .filter((d) => d.date > today)
      .reduce((sum, d) => sum + d.count, 0);
  }, [stats]);

  if (loading && !stats) {
    return <p className="text-[var(--slate)]">{t("common.loading")}</p>;
  }

  if ((error && !stats) || !stats) {
    return (
      <div className="admin-card space-y-3 p-6 text-[var(--danger)]">
        <p>{error || "Unable to load dashboard"}</p>
        <button
          type="button"
          className="btn btn-ghost inline-flex items-center gap-2"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  const schedule = stats.todaysSchedule || [];
  const recent = stats.recentBookings || [];
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        kicker="Overview"
        title={t("admin.dashboard.title")}
        description="Today's bookings, stock alerts, and recent activity."
        actions={
          <>
            <p className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)]">
              {todayLabel}
            </p>
            <button
              type="button"
              className="btn btn-ghost inline-flex items-center gap-2"
              onClick={() => void load({ soft: true })}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link
              href="/admin/eye-exam?tab=appointments&book=1"
              className="btn btn-accent"
            >
              <Plus size={16} />
              New Appointment
            </Link>
          </>
        }
      />

      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t("admin.dashboard.today")}
          value={stats.todayAppointments}
          hint="View today's schedule"
          href="/admin/eye-exam?tab=appointments"
          icon={CalendarDays}
        />
        <StatCard
          label={t("admin.dashboard.week")}
          value={stats.weekAppointments}
          icon={CalendarRange}
        />
        <StatCard
          label={t("admin.dashboard.upcoming")}
          value={upcomingCount}
          icon={Clock3}
        />
        <StatCard
          label={t("admin.dashboard.lowStock")}
          value={stats.lowStockAlerts}
          hint="View products"
          href="/admin/inventory"
          icon={AlertTriangle}
          tone={stats.lowStockAlerts > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t("admin.dashboard.customers")}
          value={stats.totalCustomers}
          icon={Users}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="admin-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="admin-section-title">Today&apos;s appointments</h2>
            <Link
              href="/admin/eye-exam?tab=appointments"
              className="text-sm font-semibold text-[var(--accent)]"
            >
              View all
            </Link>
          </div>
          <div>
            {schedule.map((a) => (
              <div key={a.id} className="admin-schedule-row">
                <p className="font-semibold text-[var(--accent)]">{a.startTime}</p>
                <div className="min-w-0">
                  <p className="admin-cell-primary truncate">{a.customerName}</p>
                  <p className="admin-cell-secondary truncate">
                    {a.customerPhone || a.customerEmail} ·{" "}
                    {serviceLabel(t, a.service)}
                  </p>
                </div>
                <span className={`status status-${a.status}`}>{a.status}</span>
              </div>
            ))}
            {!schedule.length ? (
              <p className="py-8 text-center text-sm text-[var(--slate)]">
                No appointments scheduled for today
              </p>
            ) : null}
          </div>
        </section>

        <section className="admin-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="admin-section-title">{t("admin.dashboard.recent")}</h2>
            <Link
              href="/admin/eye-exam?tab=appointments"
              className="text-sm font-semibold text-[var(--accent)]"
            >
              View all
            </Link>
          </div>
          <div>
            {recent.map((a) => (
              <div key={a.id} className="admin-schedule-row">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(212,175,55,0.12)] text-[var(--accent)]">
                  <Glasses size={18} />
                </div>
                <div className="min-w-0">
                  <p className="admin-cell-primary truncate">{a.customerName}</p>
                  <p className="admin-cell-secondary truncate">
                    {serviceLabel(t, a.service)} · {relativeCreated(a.createdAt)}
                  </p>
                </div>
                <span className={`status status-${a.status}`}>{a.status}</span>
              </div>
            ))}
            {!recent.length ? (
              <p className="py-8 text-center text-sm text-[var(--slate)]">
                {t("admin.common.noResults")}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section>
        <h2 className="admin-section-title mb-3">
          {t("admin.dashboard.quickActions")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/admin/eye-exam?tab=appointments&book=1"
            className="admin-quick-action"
          >
            <span className="admin-quick-action-icon">
              <Plus size={22} />
            </span>
            <span className="text-sm font-semibold">Add Appointment</span>
          </Link>
          <Link
            href="/admin/eye-exam?tab=availability"
            className="admin-quick-action"
          >
            <span className="admin-quick-action-icon">
              <CalendarRange size={22} />
            </span>
            <span className="text-sm font-semibold">Manage Availability</span>
          </Link>
          <Link href="/admin/inventory" className="admin-quick-action">
            <span className="admin-quick-action-icon">
              <Package size={22} />
            </span>
            <span className="text-sm font-semibold">Add Product</span>
          </Link>
          <Link href="/admin/promotions" className="admin-quick-action">
            <span className="admin-quick-action-icon">
              <Tag size={22} />
            </span>
            <span className="text-sm font-semibold">Add Promotion</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
