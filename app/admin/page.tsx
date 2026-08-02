"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Package,
  AlertTriangle,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import StatCard from "@/components/admin/StatCard";
import { apiFetch } from "@/lib/admin-api";
import type { DashboardRecentBooking, DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";

type DashboardPayload = DashboardStats & {
  todaysSchedule?: DashboardRecentBooking[];
};

function serviceLabel(
  t: (key: string) => string,
  service: string,
): string {
  const key = `clinicBooking.services.${service}`;
  const label = t(key);
  return label === key ? service : label;
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

  // Refresh when returning to the tab (e.g. after creating/updating a booking)
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

  const chartData = (stats.appointmentsByDay || []).map((d) => ({
    ...d,
    label: d.dateLabel || d.date.slice(5),
  }));
  const hasChartActivity = chartData.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1
          className="mt-1 text-3xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {t("admin.dashboard.title")}
        </h1>
        <button
          type="button"
          className="btn btn-ghost inline-flex items-center gap-2"
          onClick={() => void load({ soft: true })}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t("admin.dashboard.today")}
          value={stats.todayAppointments}
          icon={CalendarDays}
        />
        <StatCard
          label={t("admin.dashboard.week")}
          value={stats.weekAppointments}
          icon={CalendarRange}
        />
        <StatCard
          label={t("admin.dashboard.inventory")}
          value={stats.inventoryItems}
          icon={Package}
        />
        <StatCard
          label={t("admin.dashboard.lowStock")}
          value={stats.lowStockAlerts}
          icon={AlertTriangle}
          tone={stats.lowStockAlerts > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t("admin.dashboard.customers")}
          value={stats.totalCustomers}
          icon={Users}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="admin-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
              {t("admin.dashboard.chart")}
            </h2>
            <Link
              href="/admin/eye-exam"
              className="text-sm font-semibold text-[var(--accent)]"
            >
              {t("admin.sidebar.eyeExam")}
            </Link>
          </div>
          <div className="h-64 w-full">
            {hasChartActivity ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,21,28,0.08)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5a6675" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#5a6675" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(16,21,28,0.08)",
                    }}
                  />
                  <Bar dataKey="count" fill="#1a4a6b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="grid h-full place-items-center text-sm text-[var(--slate)]">
                {t("admin.common.noResults")}
              </p>
            )}
          </div>
        </section>

        <section className="admin-card p-5">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="mb-4 text-xl">
            {t("common.status")}
          </h2>
          <ul className="space-y-3">
            {(stats.statusBreakdown || []).map((row) => (
              <li
                key={row.status}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className={`status status-${row.status}`}>{row.status}</span>
                <span className="font-semibold text-[var(--ink)]">{row.count}</span>
              </li>
            ))}
            {!stats.statusBreakdown?.length ? (
              <li className="text-sm text-[var(--slate)]">
                {t("admin.common.noResults")}
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <h2 style={{ fontFamily: "Fraunces, serif" }} className="text-xl">
            {t("admin.dashboard.recent")}
          </h2>
          <Link
            href="/admin/eye-exam"
            className="text-sm font-semibold text-[var(--accent)]"
          >
            {t("admin.sidebar.eyeExam")}
          </Link>
        </div>

        {/* Mobile: compact cards */}
        <div className="space-y-3 p-4 md:hidden">
          {(stats.recentBookings || []).map((a) => (
            <article key={a.id} className="dashboard-recent-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--ink)]">{a.customerName}</p>
                  <p className="mt-0.5 text-sm text-[var(--slate)]">
                    {serviceLabel(t, a.service)}
                  </p>
                </div>
                <span className={`status status-${a.status}`}>{a.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--ink-soft)]">
                <span>{a.dateLabel || a.date}</span>
                <span>{a.startTime}</span>
              </div>
            </article>
          ))}
          {!stats.recentBookings?.length ? (
            <p className="py-6 text-center text-sm text-[var(--slate)]">
              {t("admin.common.noResults")}
            </p>
          ) : null}
        </div>

        {/* Desktop/tablet: table */}
        <div className="hidden md:block md:overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("book.steps.service")}</th>
                <th>{t("common.date")}</th>
                <th>{t("common.time")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentBookings || []).map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="font-medium text-[var(--ink)]">
                      {a.customerName}
                    </div>
                    <div className="text-xs text-[var(--slate)]">
                      {a.customerEmail}
                    </div>
                  </td>
                  <td>{serviceLabel(t, a.service)}</td>
                  <td>{a.dateLabel || a.date}</td>
                  <td>{a.startTime}</td>
                  <td>
                    <span className={`status status-${a.status}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
              {!stats.recentBookings?.length ? (
                <tr>
                  <td colSpan={5} className="text-[var(--slate)]">
                    {t("admin.common.noResults")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
