"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  Package,
  AlertTriangle,
  Users,
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
import { formatDate } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function AdminDashboardPage() {
  const { t } = useLocale();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<
          DashboardStats | { stats: DashboardStats }
        >("/api/dashboard");
        const next = "stats" in data ? data.stats : data;
        if (!cancelled) setStats(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-[var(--slate)]">{t("common.loading")}</p>;
  }

  if (error || !stats) {
    return (
      <div className="admin-card p-6 text-[var(--danger)]">
        {error || "Unable to load dashboard"}
      </div>
    );
  }

  const chartData = (stats.appointmentsByDay || []).map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1
          className="mt-1 text-3xl text-[var(--ink)]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {t("admin.dashboard.title")}
        </h1>
      </header>

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
            <Link href="/admin/calendar" className="text-sm font-semibold text-[var(--accent)]">
              {t("admin.sidebar.calendar")}
            </Link>
          </div>
          <div className="h-64 w-full">
            {chartData.length ? (
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
              <li className="text-sm text-[var(--slate)]">{t("admin.common.noResults")}</li>
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
            href="/admin/appointments"
            className="text-sm font-semibold text-[var(--accent)]"
          >
            {t("admin.sidebar.appointments")}
          </Link>
        </div>
        <div className="md:overflow-x-auto">
          <table className="table table-mobile-cards">
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
                  <td data-label={t("common.name")}>
                    <div className="font-medium text-[var(--ink)]">{a.customerName}</div>
                    <div className="text-xs text-[var(--slate)]">{a.customerEmail}</div>
                  </td>
                  <td data-label={t("book.steps.service")}>{a.service}</td>
                  <td data-label={t("common.date")}>{formatDate(a.date)}</td>
                  <td data-label={t("common.time")}>
                    {a.startTime}–{a.endTime}
                  </td>
                  <td data-label={t("common.status")}>
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
