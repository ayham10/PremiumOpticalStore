"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Clock3,
  Database,
  DatabaseBackup,
  Image as ImageIcon,
  Info,
  Package,
  Settings,
  ShieldCheck,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
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
  type ManualBackupClientResult,
} from "@/lib/backup-status";
import type {
  RestoreCategory,
  RestoreExecuteClientResult,
  RestorePreviewResult,
} from "@/lib/restore-status";
import { isLiveRestoreUiAllowed } from "@/lib/restore-status";

const HISTORY_PREVIEW = 5;

const RESTORE_ITEMS: Array<{
  key: RestoreCategory;
  icon: LucideIcon;
}> = [
  { key: "bookings", icon: CalendarDays },
  { key: "products", icon: Package },
  { key: "lenses", icon: Database },
  { key: "settings", icon: Settings },
  { key: "promotions", icon: Tag },
];

function statusIcon(status: BackupHealthStatus | BackupRowStatus) {
  if (status === "healthy" || status === "success") return CircleCheck;
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
  const { notifySaved } = useAdminSuccessNotice();
  const [data, setData] = useState<BackupStatusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<RestoreCategory[]>([]);
  const [restoreError, setRestoreError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [preview, setPreview] = useState<RestorePreviewResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError("");
    }
    try {
      const summary = await apiFetch<BackupStatusSummary>("/api/admin/backups");
      setData(summary);
      if (!opts?.silent) setError("");
    } catch (err) {
      if (!opts?.silent) {
        setData(null);
        if (err instanceof ApiError && err.status === 403) {
          setError(t("admin.backups.forbidden"));
        } else {
          setError(
            err instanceof Error ? err.message : t("admin.backups.loadError"),
          );
        }
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createManualBackup = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setActionError("");
    try {
      const result = await apiFetch<ManualBackupClientResult>(
        "/api/admin/backups",
        { method: "POST" },
      );
      if (!result.complete) {
        setActionError(t("admin.backups.createIncomplete"));
        return;
      }
      notifySaved({
        title: t("admin.backups.createSuccess"),
        detail: formatBackupDateTime(result.createdAt),
      });
      await load({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setActionError(t("admin.backups.createInProgress"));
      } else if (err instanceof ApiError && err.status === 429) {
        setActionError(t("admin.backups.createTooSoon"));
      } else if (err instanceof ApiError && err.status === 403) {
        setActionError(t("admin.backups.createForbidden"));
      } else if (err instanceof ApiError && err.status === 503) {
        setActionError(t("admin.backups.createIncomplete"));
      } else {
        setActionError(t("admin.backups.createError"));
      }
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [load, notifySaved, t]);

  const toggleCategory = useCallback((key: RestoreCategory) => {
    setSelectedCategories((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
    setRestoreError("");
  }, []);

  const selectedBackup =
    data?.history.find((row) => row.id === selectedBackupId) ?? null;

  const openPreview = useCallback(async () => {
    if (!selectedBackupId || selectedCategories.length === 0 || previewing) return;
    setPreviewing(true);
    setRestoreError("");
    setConfirmOpen(false);
    try {
      const result = await apiFetch<RestorePreviewResult>(
        "/api/admin/backups/restore/preview",
        {
          method: "POST",
          body: JSON.stringify({
            backupId: selectedBackupId,
            categories: selectedCategories,
          }),
        },
      );
      setPreview(result);
    } catch (err) {
      setPreview(null);
      if (err instanceof ApiError && err.status === 403) {
        setRestoreError(t("admin.backups.restoreForbidden"));
      } else {
        setRestoreError(
          err instanceof Error ? err.message : t("admin.backups.restorePreviewError"),
        );
      }
    } finally {
      setPreviewing(false);
    }
  }, [previewing, selectedBackupId, selectedCategories, t]);

  const liveRestoreAllowed = isLiveRestoreUiAllowed();

  const runRestore = useCallback(async () => {
    if (!preview || restoring || !liveRestoreAllowed) return;
    setRestoring(true);
    setRestoreError("");
    try {
      await apiFetch<RestoreExecuteClientResult>(
        "/api/admin/backups/restore",
        {
          method: "POST",
          body: JSON.stringify({
            backupId: preview.backup.id,
            categories: preview.categories,
            confirm: true,
          }),
        },
      );
      setPreview(null);
      setConfirmOpen(false);
      notifySaved({
        title: t("admin.backups.restoreSuccess"),
        detail: formatBackupDateTime(preview.backup.createdAt),
      });
      await load({ silent: true });
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.message === t("admin.backups.restoreProductionOnly")
      ) {
        setRestoreError(t("admin.backups.restoreProductionOnly"));
      } else if (err instanceof ApiError && err.status === 403) {
        setRestoreError(t("admin.backups.restoreForbidden"));
      } else {
        setRestoreError(
          err instanceof Error ? err.message : t("admin.backups.restoreError"),
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [liveRestoreAllowed, load, notifySaved, preview, restoring, t]);

  const lastSuccessful = lastSuccessfulOf(data);
  const status = data?.status ?? "none";
  const StatusIcon = statusIcon(status);
  const autoConfigured = Boolean(data?.automatic.enabled);
  const autoBoxStatus = !data
    ? "pending"
    : autoConfigured && status === "healthy"
      ? "healthy"
      : status === "warning"
        ? "warning"
        : status === "failed"
          ? "failed"
          : "none";
  const autoBoxLabel =
    autoBoxStatus === "pending"
      ? "—"
      : autoBoxStatus === "healthy"
        ? t("admin.backups.automaticOn")
        : autoBoxStatus === "warning"
          ? t("admin.backups.autoStatusWarning")
          : autoBoxStatus === "failed"
            ? t("admin.backups.autoStatusFailed")
            : t("admin.backups.autoStatusNone");
  const history = data?.history ?? [];
  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, HISTORY_PREVIEW);
  const mediaCount =
    data?.media.protectedCount ?? lastSuccessful?.mediaObjectCount ?? null;

  const metrics = useMemo(
    () => [
      {
        key: "appointments",
        label: t("admin.backups.sectionAppointments"),
        value: countLabel(lastSuccessful?.appointments),
        note: null as string | null,
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
        note: t("admin.backups.retentionNote"),
        icon: Clock3,
      },
    ],
    [data?.retentionDays, lastSuccessful, mediaCount, t],
  );

  return (
    <div className="admin-backups-page">
      <header className="admin-backups-head">
        <div className="admin-backups-head-title">
          <DatabaseBackup size={22} strokeWidth={1.6} aria-hidden />
          <h1>{t("admin.backups.title")}</h1>
        </div>
        <p>{t("admin.backups.description")}</p>
      </header>

      {error ? <p className="admin-backups-error">{error}</p> : null}

      <section className={`admin-backups-card admin-backups-status is-${status}`}>
        <div className="admin-backups-status-main">
          <div className="admin-backups-status-label">
            <StatusIcon size={22} strokeWidth={2} aria-hidden />
            <span>{t("admin.backups.statusTitle")}</span>
          </div>
          <h2>{t(`admin.backups.status_${status}`)}</h2>
          <p className="admin-backups-last-label">{t("admin.backups.lastSuccess")}</p>
          <p className="admin-backups-last-value">
            {loading && !data
              ? "—"
              : lastSuccessful
                ? formatBackupDateTime(lastSuccessful.createdAt)
                : t("admin.backups.noneYet")}
          </p>
        </div>
        <div className="admin-backups-status-divider" aria-hidden />
        <div className="admin-backups-status-action">
          <button
            type="button"
            className="admin-backups-now"
            disabled={creating}
            onClick={() => void createManualBackup()}
          >
            <Database size={16} strokeWidth={1.8} aria-hidden />
            <span>
              {creating
                ? t("admin.backups.creatingNow")
                : t("admin.backups.createNow")}
            </span>
          </button>
          {actionError ? (
            <p className="admin-backups-action-error" role="alert">
              {actionError}
            </p>
          ) : (
            <p>{t("admin.backups.createNowHint")}</p>
          )}
        </div>
      </section>

      <div className="admin-backups-metrics">
        {metrics.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className="admin-backups-card admin-backups-metric">
              <div className="admin-backups-metric-top">
                <p>{card.label}</p>
                <span aria-hidden>
                  <Icon size={16} strokeWidth={1.7} />
                </span>
              </div>
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

      <section className="admin-backups-card admin-backups-history">
        <div className="admin-backups-section-head">
          <div>
            <DatabaseBackup size={16} strokeWidth={1.7} aria-hidden />
            <h2>{t("admin.backups.historyTitle")}</h2>
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
              <ChevronLeft size={14} strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <span className="admin-backups-more is-static">
              {t("admin.backups.showAll")}
              <ChevronLeft size={14} strokeWidth={2} aria-hidden />
            </span>
          )}
        </div>
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
                visibleHistory.map((row, index) => (
                  <HistoryRow
                    key={row.id}
                    row={row}
                    t={t}
                    current={index === 0}
                    selected={row.id === selectedBackupId}
                    onSelect={() => {
                      setSelectedBackupId(row.id);
                      setRestoreError("");
                    }}
                  />
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
                key={row.id}
                row={row}
                t={t}
                selected={row.id === selectedBackupId}
                onSelect={() => {
                  setSelectedBackupId(row.id);
                  setRestoreError("");
                }}
              />
            ))
          )}
        </div>
      </section>

      <div className="admin-backups-bottom">
        <section className="admin-backups-card admin-backups-restore">
          <div className="admin-backups-section-head">
            <div>
              <ShieldCheck size={16} strokeWidth={1.7} aria-hidden />
              <h2>{t("admin.backups.restoreTitle")}</h2>
            </div>
          </div>
          <p className="admin-backups-lead">{t("admin.backups.restoreLead")}</p>
          <p className="admin-backups-restore-pick">
            {selectedBackup
              ? `${t("admin.backups.restoreSelected")} ${formatBackupDateTime(selectedBackup.createdAt)} — ${
                  selectedBackup.kind === "manual"
                    ? t("admin.backups.kindManual")
                    : t("admin.backups.kindDaily")
                }`
              : t("admin.backups.restorePickBackup")}
          </p>
          <ul>
            {RESTORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = selectedCategories.includes(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={active ? "is-active" : undefined}
                    onClick={() => toggleCategory(item.key)}
                  >
                    <Icon size={14} strokeWidth={1.7} aria-hidden />
                    <span>{t(`admin.backups.restore_${item.key}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {restoreError ? (
            <p className="admin-backups-action-error" role="alert">
              {restoreError}
            </p>
          ) : null}
          <button
            type="button"
            className="admin-backups-restore-go"
            disabled={
              !selectedBackupId ||
              selectedCategories.length === 0 ||
              previewing ||
              restoring
            }
            onClick={() => void openPreview()}
          >
            {previewing
              ? t("admin.backups.restorePreviewing")
              : t("admin.backups.restorePreview")}
          </button>
          {!liveRestoreAllowed ? (
            <p className="admin-backups-restore-prod-only" role="status">
              {t("admin.backups.restoreProductionOnly")}
            </p>
          ) : null}
        </section>

        <section className="admin-backups-card admin-backups-auto">
          <div className="admin-backups-section-head">
            <div>
              <Settings size={16} strokeWidth={1.7} aria-hidden />
              <h2>{t("admin.backups.autoTitle")}</h2>
            </div>
          </div>
          <p className="admin-backups-lead">{t("admin.backups.autoLead")}</p>
          <dl>
            <div>
              <Clock3 size={16} strokeWidth={1.7} aria-hidden />
              <dt>{t("admin.backups.autoTime")}</dt>
              <dd>{data?.automatic.localTime || "03:00"}</dd>
              <p className="admin-backups-auto-note">
                {t("admin.backups.autoTimeZone")}
              </p>
            </div>
            <div>
              <CalendarDays size={16} strokeWidth={1.7} aria-hidden />
              <dt>{t("admin.backups.autoSchedule")}</dt>
              <dd>{t("admin.backups.autoEveryDay")}</dd>
              <p className="admin-backups-auto-note">
                {t("admin.backups.autoDailyCopy")}
              </p>
            </div>
            <div className={`is-${autoBoxStatus}`}>
              <i />
              <dt>{t("admin.backups.statusTitleShort")}</dt>
              <dd>{autoBoxLabel}</dd>
            </div>
          </dl>
          <p className="admin-backups-info-bar">
            <Info size={13} strokeWidth={1.8} aria-hidden />
            {t("admin.backups.autoLocalNote", {
              time: data?.automatic.localTime || "03:00",
            })}
          </p>
        </section>
      </div>
      {preview ? (
        <RestoreDialog
          preview={preview}
          confirmOpen={confirmOpen}
          restoring={restoring}
          executeAllowed={liveRestoreAllowed}
          t={t}
          onClose={() => {
            if (restoring) return;
            setPreview(null);
            setConfirmOpen(false);
          }}
          onAskConfirm={() => setConfirmOpen(true)}
          onConfirm={() => void runRestore()}
        />
      ) : null}
    </div>
  );
}

function KindBadge({
  kind,
  t,
}: {
  kind: BackupHistoryItem["kind"];
  t: (key: string) => string;
}) {
  return (
    <span className={`admin-backups-kind is-${kind}`}>
      {kind === "manual"
        ? t("admin.backups.kindManual")
        : t("admin.backups.kindDaily")}
    </span>
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
      <Icon size={15} strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}

function HistoryRow({
  row,
  t,
  current,
  selected,
  onSelect,
}: {
  row: BackupHistoryItem;
  t: (key: string) => string;
  current?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <tr
      className={[current ? "is-current" : "", selected ? "is-selected" : ""]
        .filter(Boolean)
        .join(" ") || undefined}
      onClick={row.status === "success" ? onSelect : undefined}
    >
      <td>
        <span className="admin-backups-date-cell">
          {formatBackupDate(row.date)}
          <KindBadge kind={row.kind} t={t} />
        </span>
      </td>
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
  selected,
  onSelect,
}: {
  row: BackupHistoryItem;
  t: (key: string) => string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`admin-backups-history-item${selected ? " is-selected" : ""}`}
      onClick={row.status === "success" ? onSelect : undefined}
    >
      <div>
        <strong>
          {formatBackupDate(row.date)} • {formatBackupTime(row.createdAt)}{" "}
          <KindBadge kind={row.kind} t={t} />
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

function RestoreDialog({
  preview,
  confirmOpen,
  restoring,
  executeAllowed,
  t,
  onClose,
  onAskConfirm,
  onConfirm,
}: {
  preview: RestorePreviewResult;
  confirmOpen: boolean;
  restoring: boolean;
  executeAllowed: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onAskConfirm: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="admin-restore-overlay"
      role="presentation"
      dir="rtl"
      onClick={restoring ? undefined : onClose}
    >
      <div
        className="admin-restore-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-restore-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="admin-restore-title">
          {confirmOpen
            ? t("admin.backups.restoreConfirmTitle")
            : t("admin.backups.restorePreviewTitle")}
        </h2>
        <p className="admin-restore-meta">
          {formatBackupDateTime(preview.backup.createdAt)} —{" "}
          {preview.backup.kind === "manual"
            ? t("admin.backups.kindManual")
            : t("admin.backups.kindDaily")}
        </p>
        <ul className="admin-restore-sections">
          {preview.sections.map((section) => (
            <li key={section.category}>
              <strong>{t(`admin.backups.restore_${section.category}`)}</strong>
              <span>
                {t("admin.backups.restoreLiveCount")} {section.liveCount}
              </span>
              <span>
                {t("admin.backups.restoreBackupCount")} {section.backupCount}
              </span>
            </li>
          ))}
        </ul>
        <p className="admin-restore-warning">
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          {t("admin.backups.restoreWarning")}
        </p>
        <div className="admin-restore-actions">
          <button
            type="button"
            className="admin-restore-cancel"
            disabled={restoring}
            onClick={onClose}
          >
            {t("admin.backups.restoreCancel")}
          </button>
          {confirmOpen ? (
            executeAllowed ? (
              <button
                type="button"
                className="admin-restore-confirm"
                disabled={restoring}
                onClick={onConfirm}
              >
                {restoring
                  ? t("admin.backups.restoreRunning")
                  : t("admin.backups.restoreConfirm")}
              </button>
            ) : (
              <p className="admin-restore-prod-only" role="status">
                {t("admin.backups.restoreProductionOnly")}
              </p>
            )
          ) : (
            <button
              type="button"
              className="admin-restore-next"
              onClick={onAskConfirm}
            >
              {t("admin.backups.restoreContinue")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
