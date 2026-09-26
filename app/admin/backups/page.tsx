"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleX,
  Clock3,
  DatabaseBackup,
  HardDrive,
  ImageIcon,
  RefreshCw,
  ShieldCheck,
  Timer,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch, ApiError } from "@/lib/admin-api";
import {
  formatBackupBytes,
  formatBackupDate,
  formatBackupDateTime,
  formatBackupTime,
  type BackupHealthStatus,
  type BackupStatusSummary,
} from "@/lib/backup-status";

const RESTORE_KEYS = [
  "appointments",
  "products",
  "lenses",
  "settings",
  "promotions",
  "customers",
] as const;

function statusIcon(status: BackupHealthStatus) {
  if (status === "healthy") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  return CircleX;
}

function countLabel(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

export default function AdminBackupsPage() {
  const { t } = useLocale();
  const [data, setData] = useState<BackupStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const summary = await apiFetch<BackupStatusSummary>("/api/admin/backups");
      setData(summary);
    } catch (err) {
      setData(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(t("admin.backups.forbidden"));
      } else {
        setError(
          err instanceof Error ? err.message : t("admin.backups.loadError"),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = data?.latest ?? null;
  const status = data?.status ?? "none";
  const StatusIcon = statusIcon(status);

  const summaryCards = [
    {
      key: "latest",
      label: t("admin.backups.cardLatest"),
      value: latest ? formatBackupDateTime(latest.createdAt) : "—",
      icon: CalendarClock,
      compact: true,
    },
    {
      key: "size",
      label: t("admin.backups.cardSize"),
      value: latest ? formatBackupBytes(latest.sizeBytes) : "—",
      icon: HardDrive,
    },
    {
      key: "media",
      label: t("admin.backups.cardMedia"),
      value: countLabel(
        data?.media.protectedCount ?? latest?.mediaObjectCount ?? null,
      ),
      icon: ImageIcon,
    },
    {
      key: "retention",
      label: t("admin.backups.cardRetention"),
      value: t("admin.backups.retentionDays", {
        days: data?.retentionDays ?? 30,
      }),
      icon: Timer,
    },
  ] as const;

  const sectionCards = [
    { key: "appointments", label: t("admin.backups.sectionAppointments"), value: latest?.appointments },
    { key: "products", label: t("admin.backups.sectionProducts"), value: latest?.products },
    { key: "lenses", label: t("admin.backups.sectionLenses"), value: latest?.lensInventory },
    { key: "customers", label: t("admin.backups.sectionCustomers"), value: latest?.customers },
    { key: "promotions", label: t("admin.backups.sectionPromotions"), value: latest?.promotions },
  ] as const;

  return (
    <div className="admin-backups-page space-y-5">
      <AdminPageHeader
        icon={DatabaseBackup}
        kicker={t("admin.backups.kicker")}
        title={t("admin.backups.title")}
        description={t("admin.backups.description")}
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {t("admin.backups.refresh")}
          </button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <section className={`admin-card admin-backups-status is-${status}`}>
        <div className="admin-backups-status-main">
          <p className="admin-card-label">{t("admin.backups.statusTitle")}</p>
          <div className="admin-backups-status-row">
            <StatusIcon size={22} strokeWidth={1.7} aria-hidden />
            <h2 className="admin-backups-status-text">
              {t(`admin.backups.status_${status}`)}
            </h2>
          </div>
        </div>
        <dl className="admin-backups-status-meta">
          <div>
            <dt>{t("admin.backups.lastSuccess")}</dt>
            <dd>
              {loading && !data
                ? "—"
                : latest
                  ? formatBackupDateTime(latest.createdAt)
                  : t("admin.backups.noneYet")}
            </dd>
          </div>
          <div>
            <dt>{t("admin.backups.automaticLabel")}</dt>
            <dd>
              {data?.automatic.enabled
                ? t("admin.backups.automaticOn")
                : t("admin.backups.automaticOff")}
            </dd>
          </div>
          <div>
            <dt>{t("admin.backups.retentionLabel")}</dt>
            <dd>
              {t("admin.backups.retentionDays", {
                days: data?.retentionDays ?? 30,
              })}
            </dd>
          </div>
        </dl>
      </section>

      <div className="admin-stock-summary">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className="admin-card admin-stock-card is-gold">
              <div>
                <p className="admin-card-label">{card.label}</p>
                <p
                  className={
                    card.compact
                      ? "admin-backups-card-value is-compact"
                      : "admin-backups-card-value"
                  }
                >
                  {loading && !data ? "—" : card.value}
                </p>
              </div>
              <span className="admin-stock-card-icon">
                <Icon size={18} strokeWidth={1.6} />
              </span>
            </article>
          );
        })}
      </div>

      <section className="admin-card admin-backups-sections">
        <div className="admin-backups-section-head">
          <ShieldCheck size={18} strokeWidth={1.6} aria-hidden />
          <h2>{t("admin.backups.contentsTitle")}</h2>
        </div>
        <div className="admin-backups-section-grid">
          {sectionCards.map((card) => (
            <article key={card.key}>
              <p className="admin-card-label">{card.label}</p>
              <p className="admin-backups-count">
                {loading && !data ? "—" : countLabel(card.value)}
              </p>
            </article>
          ))}
        </div>
        <p className="admin-backups-settings-note">
          {latest?.settingsIncluded || !latest
            ? t("admin.backups.settingsIncluded")
            : t("admin.backups.settingsMissing")}
        </p>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="admin-backups-section-head">
          <DatabaseBackup size={18} strokeWidth={1.6} aria-hidden />
          <h2>{t("admin.backups.historyTitle")}</h2>
        </div>
        <div className="md:overflow-x-auto">
          <table className="table table-mobile-cards">
            <thead>
              <tr>
                <th>{t("admin.backups.colDate")}</th>
                <th>{t("admin.backups.colTime")}</th>
                <th>{t("admin.backups.colSize")}</th>
                <th>{t("admin.backups.colAppointments")}</th>
                <th>{t("admin.backups.colProducts")}</th>
                <th>{t("admin.backups.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={6} className="text-[var(--slate)]">
                    {t("admin.backups.loading")}
                  </td>
                </tr>
              ) : !data?.history.length ? (
                <tr>
                  <td colSpan={6} className="text-[var(--slate)]">
                    {t("admin.backups.historyEmpty")}
                  </td>
                </tr>
              ) : (
                data.history.map((row) => (
                  <tr key={`${row.date}-${row.createdAt}`}>
                    <td data-label={t("admin.backups.colDate")}>
                      {formatBackupDate(row.date)}
                    </td>
                    <td data-label={t("admin.backups.colTime")}>
                      {formatBackupTime(row.createdAt)}
                    </td>
                    <td data-label={t("admin.backups.colSize")}>
                      {formatBackupBytes(row.sizeBytes)}
                    </td>
                    <td data-label={t("admin.backups.colAppointments")}>
                      {countLabel(row.appointments)}
                    </td>
                    <td data-label={t("admin.backups.colProducts")}>
                      {countLabel(row.products)}
                    </td>
                    <td data-label={t("admin.backups.colStatus")}>
                      <span className="admin-backups-ok">
                        <CheckCircle2 size={14} strokeWidth={1.8} aria-hidden />
                        {t("admin.backups.rowSuccess")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-backups-section-head">
          <ImageIcon size={18} strokeWidth={1.6} aria-hidden />
          <h2>{t("admin.backups.mediaTitle")}</h2>
        </div>
        <dl className="admin-backups-meta-list">
          <div>
            <dt>{t("admin.backups.mediaCount")}</dt>
            <dd>
              {loading && !data
                ? "—"
                : countLabel(data?.media.protectedCount ?? null)}
            </dd>
          </div>
          <div>
            <dt>{t("admin.backups.mediaIncremental")}</dt>
            <dd>{t("admin.backups.automaticOn")}</dd>
          </div>
          <div>
            <dt>{t("admin.backups.mediaLastSync")}</dt>
            <dd>
              {data?.media.lastSyncedAt
                ? formatBackupDateTime(data.media.lastSyncedAt)
                : t("admin.backups.noneYet")}
            </dd>
          </div>
        </dl>
        <p className="admin-muted admin-backups-note">
          {t("admin.backups.mediaNote")}
        </p>
      </section>

      <section className="admin-card">
        <div className="admin-backups-section-head">
          <Clock3 size={18} strokeWidth={1.6} aria-hidden />
          <h2>{t("admin.backups.autoTitle")}</h2>
        </div>
        <dl className="admin-backups-meta-list">
          <div>
            <dt>{t("admin.backups.automaticLabel")}</dt>
            <dd>{t("admin.backups.automaticOn")}</dd>
          </div>
          <div>
            <dt>{t("admin.backups.autoSchedule")}</dt>
            <dd>{t("admin.backups.autoDaily")}</dd>
          </div>
          <div>
            <dt>{t("admin.backups.autoTime")}</dt>
            <dd>00:00 UTC</dd>
          </div>
          <div>
            <dt>{t("admin.backups.autoLocal")}</dt>
            <dd>
              {data?.automatic.localTime
                ? `${data.automatic.localTime} (${t("admin.backups.autoLocalZone")})`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="admin-card admin-backups-restore">
        <div className="admin-backups-section-head">
          <ShieldCheck size={18} strokeWidth={1.6} aria-hidden />
          <h2>{t("admin.backups.restoreTitle")}</h2>
        </div>
        <p className="admin-muted admin-backups-note">
          {t("admin.backups.restoreLead")}
        </p>
        <ul className="admin-backups-restore-list">
          {RESTORE_KEYS.map((key) => (
            <li key={key}>
              <span>{t(`admin.backups.restore_${key}`)}</span>
              <button type="button" className="btn btn-ghost" disabled>
                {t("admin.backups.comingSoon")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
