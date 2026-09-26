"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Blend,
  CalendarDays,
  CheckCircle2,
  CircleX,
  DatabaseBackup,
  ImageIcon,
  Lock,
  Package,
  Settings,
  Tag,
  Timer,
  Users,
  type LucideIcon,
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
  type BackupHistoryItem,
  type BackupRowStatus,
  type BackupStatusSummary,
} from "@/lib/backup-status";

const HISTORY_PREVIEW = 5;

const RESTORE_ITEMS: Array<{
  key: "appointments" | "products" | "lenses" | "settings" | "promotions" | "customers";
  icon: LucideIcon;
}> = [
  { key: "appointments", icon: CalendarDays },
  { key: "products", icon: Package },
  { key: "lenses", icon: Blend },
  { key: "settings", icon: Settings },
  { key: "promotions", icon: Tag },
  { key: "customers", icon: Users },
];

function statusIcon(status: BackupHealthStatus | BackupRowStatus) {
  if (status === "healthy" || status === "success") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  return CircleX;
}

function countLabel(value: number | null | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function lastSuccessfulOf(data: BackupStatusSummary | null): BackupHistoryItem | null {
  return data?.lastSuccessful ?? data?.latest ?? null;
}

export default function AdminBackupsPage() {
  const { t } = useLocale();
  const [data, setData] = useState<BackupStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

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

  const lastSuccessful = lastSuccessfulOf(data);
  const status = data?.status ?? "none";
  const StatusIcon = statusIcon(status);
  const history = data?.history ?? [];
  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, HISTORY_PREVIEW);

  const mediaCount = data?.media.protectedCount ?? lastSuccessful?.mediaObjectCount ?? null;

  const metrics = useMemo(
    () => [
      {
        key: "appointments",
        label: t("admin.backups.sectionAppointments"),
        value: countLabel(lastSuccessful?.appointments),
        note: null,
        icon: CalendarDays,
      },
      {
        key: "products",
        label: t("admin.backups.sectionProducts"),
        value: countLabel(lastSuccessful?.products),
        note: null,
        icon: Package,
      },
      {
        key: "media",
        label: t("admin.backups.cardMedia"),
        value:
          mediaCount == null
            ? "—"
            : t("admin.backups.mediaPhotos", { n: mediaCount }),
        note: t("admin.backups.incrementalOn"),
        icon: ImageIcon,
      },
      {
        key: "retention",
        label: t("admin.backups.cardRetention"),
        value: t("admin.backups.retentionDays", {
          days: data?.retentionDays ?? 30,
        }),
        note: null,
        icon: Timer,
      },
    ],
    [data?.retentionDays, lastSuccessful, mediaCount, t],
  );

  return (
    <div className="admin-backups-page">
      <AdminPageHeader
        icon={DatabaseBackup}
        title={t("admin.backups.title")}
        description={t("admin.backups.description")}
      />

      {error ? (
        <p className="admin-backups-error">{error}</p>
      ) : null}

      <section className={`admin-card admin-backups-status is-${status}`}>
        <div className="admin-backups-status-main">
          <p className="admin-backups-kicker">{t("admin.backups.statusTitle")}</p>
          <div className="admin-backups-status-row">
            <StatusIcon size={36} strokeWidth={1.8} aria-hidden />
            <h2>{t(`admin.backups.status_${status}`)}</h2>
          </div>
          <p className="admin-backups-last">
            <span>{t("admin.backups.lastSuccess")}</span>
            <strong>
              {loading && !data
                ? "—"
                : lastSuccessful
                  ? formatBackupDateTime(lastSuccessful.createdAt)
                  : t("admin.backups.noneYet")}
            </strong>
          </p>
        </div>
        <div className="admin-backups-status-action">
          <button type="button" className="admin-backups-now" disabled>
            <span>{t("admin.backups.createNow")}</span>
            <em>{t("admin.backups.comingSoon")}</em>
          </button>
          <p>{t("admin.backups.createNowHint")}</p>
        </div>
      </section>

      <div className="admin-backups-metrics">
        {metrics.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className="admin-card admin-backups-metric">
              <span className="admin-backups-metric-icon" aria-hidden>
                <Icon size={16} strokeWidth={1.7} />
              </span>
              <p className="admin-backups-kicker">{card.label}</p>
              <p className="admin-backups-metric-value">
                {loading && !data ? "—" : card.value}
              </p>
              {card.note ? (
                <p className="admin-backups-metric-note">{card.note}</p>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="admin-card admin-backups-history">
        <h2>{t("admin.backups.historyTitle")}</h2>
        <div className="admin-backups-history-desktop">
          <table>
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
                  <td colSpan={6}>{t("admin.backups.loading")}</td>
                </tr>
              ) : visibleHistory.length === 0 ? (
                <tr>
                  <td colSpan={6}>{t("admin.backups.historyEmpty")}</td>
                </tr>
              ) : (
                visibleHistory.map((row) => (
                  <HistoryRow key={`${row.date}-${row.createdAt}`} row={row} t={t} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-backups-history-mobile">
          {loading && !data ? (
            <p className="admin-backups-empty">{t("admin.backups.loading")}</p>
          ) : visibleHistory.length === 0 ? (
            <p className="admin-backups-empty">{t("admin.backups.historyEmpty")}</p>
          ) : (
            visibleHistory.map((row) => (
              <HistoryMobileRow
                key={`${row.date}-${row.createdAt}`}
                row={row}
                t={t}
              />
            ))
          )}
        </div>
        {history.length > HISTORY_PREVIEW ? (
          <button
            type="button"
            className="admin-backups-more"
            onClick={() => setShowAllHistory((open) => !open)}
          >
            {showAllHistory
              ? t("admin.backups.showLess")
              : t("admin.backups.showAll")}
          </button>
        ) : null}
      </section>

      <div className="admin-backups-bottom">
        <section className="admin-card admin-backups-restore">
          <h2>{t("admin.backups.restoreTitle")}</h2>
          <p>{t("admin.backups.restoreLead")}</p>
          <ul>
            {RESTORE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Icon size={14} strokeWidth={1.7} aria-hidden />
                  <span>{t(`admin.backups.restore_${item.key}`)}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="admin-backups-soon" disabled>
            <Lock size={14} strokeWidth={1.8} aria-hidden />
            {t("admin.backups.comingSoon")}
          </button>
        </section>

        <section className="admin-card admin-backups-auto">
          <h2>{t("admin.backups.autoTitle")}</h2>
          <dl>
            <div>
              <dd>
                <i />
                {t("admin.backups.automaticOn")}
              </dd>
              <dt>{t("admin.backups.statusTitleShort")}</dt>
            </div>
            <div>
              <dd>{t("admin.backups.autoDaily")}</dd>
              <dt>{t("admin.backups.autoSchedule")}</dt>
            </div>
            <div>
              <dd>00:00 UTC</dd>
              <dt>{t("admin.backups.autoTime")}</dt>
            </div>
          </dl>
          <p>
            {t("admin.backups.autoLocalNote", {
              time: data?.automatic.localTime || "03:00",
            })}
          </p>
        </section>
      </div>
    </div>
  );
}

function RowStatus({
  status,
  t,
}: {
  status: BackupRowStatus;
  t: (key: string) => string;
}) {
  const Icon = statusIcon(status);
  const label =
    status === "success"
      ? t("admin.backups.rowSuccess")
      : status === "warning"
        ? t("admin.backups.rowWarning")
        : t("admin.backups.rowFailed");
  return (
    <span className={`admin-backups-row-status is-${status}`}>
      <Icon size={13} strokeWidth={1.9} aria-hidden />
      {label}
    </span>
  );
}

function HistoryRow({
  row,
  t,
}: {
  row: BackupHistoryItem;
  t: (key: string) => string;
}) {
  return (
    <tr>
      <td>{formatBackupDate(row.date)}</td>
      <td>{formatBackupTime(row.createdAt)}</td>
      <td>{formatBackupBytes(row.sizeBytes)}</td>
      <td>{countLabel(row.appointments)}</td>
      <td>{countLabel(row.products)}</td>
      <td>
        <RowStatus status={row.status} t={t} />
      </td>
    </tr>
  );
}

function HistoryMobileRow({
  row,
  t,
}: {
  row: BackupHistoryItem;
  t: (key: string) => string;
}) {
  return (
    <article className="admin-backups-history-item">
      <div>
        <strong>
          {formatBackupDate(row.date)} • {formatBackupTime(row.createdAt)}
        </strong>
        <RowStatus status={row.status} t={t} />
      </div>
      <p>
        <span>{formatBackupBytes(row.sizeBytes)}</span>
        <span>
          {t("admin.backups.colAppointments")} {countLabel(row.appointments)}
        </span>
        <span>
          {t("admin.backups.colProducts")} {countLabel(row.products)}
        </span>
      </p>
    </article>
  );
}
