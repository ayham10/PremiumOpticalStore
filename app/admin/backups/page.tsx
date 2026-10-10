"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Clock3,
  Database,
  DatabaseBackup,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  Package,
  RotateCcw,
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
  MembershipPolicy,
  RestoreCategory,
  RestoreChangeItem,
  RestoreExecuteClientResult,
  RestoreMode,
  RestorePreviewResult,
  RestoreSnapshotItems,
} from "@/lib/restore-status";
import { isLiveRestoreUiAllowed } from "@/lib/restore-status";
import {
  isGithubBackupUiAllowed,
  type GithubBackupClientResult,
  type GithubBackupStatusSummary,
} from "@/lib/github-backup-status";

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

const RESTORE_MODES: Array<{
  key: Exclude<RestoreMode, "rollback">;
  icon: LucideIcon;
}> = [
  { key: "sections", icon: Layers },
  { key: "full", icon: Database },
  { key: "customPage", icon: FileText },
  { key: "product", icon: Package },
  { key: "categoryWithProducts", icon: Tag },
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
  const [githubCreating, setGithubCreating] = useState(false);
  const githubCreatingRef = useRef(false);
  const [githubError, setGithubError] = useState("");
  const [githubStatus, setGithubStatus] = useState<GithubBackupStatusSummary | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<RestoreCategory[]>([]);
  const [restoreMode, setRestoreMode] = useState<Exclude<RestoreMode, "rollback">>("sections");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [membershipPolicy, setMembershipPolicy] =
    useState<MembershipPolicy>("preserve-live");
  const [snapshotItems, setSnapshotItems] = useState<RestoreSnapshotItems | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
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

  const githubBackupAllowed = isGithubBackupUiAllowed();

  const loadGithubStatus = useCallback(async () => {
    if (!githubBackupAllowed) {
      setGithubStatus(null);
      return;
    }
    try {
      const summary = await apiFetch<GithubBackupStatusSummary>(
        "/api/admin/github-backups",
      );
      setGithubStatus(summary);
    } catch {
      setGithubStatus(null);
    }
  }, [githubBackupAllowed]);

  useEffect(() => {
    void loadGithubStatus();
  }, [loadGithubStatus]);

  const createGithubBackup = useCallback(async () => {
    if (githubCreatingRef.current || !githubBackupAllowed) return;
    githubCreatingRef.current = true;
    setGithubCreating(true);
    setGithubError("");
    try {
      const result = await apiFetch<GithubBackupClientResult>(
        "/api/admin/github-backups",
        { method: "POST" },
      );
      if (!result.complete) {
        setGithubError(t("admin.backups.backupAllIncomplete"));
        return;
      }
      notifySaved({
        title: t("admin.backups.backupAllSuccess"),
        detail: formatBackupDateTime(result.createdAt),
      });
      await loadGithubStatus();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.message === t("admin.backups.backupAllProductionOnly")
      ) {
        setGithubError(t("admin.backups.backupAllProductionOnly"));
      } else if (err instanceof ApiError && err.status === 409) {
        setGithubError(t("admin.backups.backupAllInProgress"));
      } else if (err instanceof ApiError && err.status === 403) {
        setGithubError(t("admin.backups.backupAllForbidden"));
      } else if (err instanceof ApiError && err.status === 502) {
        setGithubError(t("admin.backups.backupAllRepoInaccessible"));
      } else if (err instanceof ApiError && err.status === 503) {
        setGithubError(t("admin.backups.backupAllIncomplete"));
      } else {
        setGithubError(t("admin.backups.backupAllError"));
      }
    } finally {
      githubCreatingRef.current = false;
      setGithubCreating(false);
    }
  }, [githubBackupAllowed, loadGithubStatus, notifySaved, t]);

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

  const needsItems =
    restoreMode === "customPage" ||
    restoreMode === "product" ||
    restoreMode === "categoryWithProducts";

  useEffect(() => {
    if (!selectedBackupId || !needsItems) {
      setSnapshotItems(null);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    setSnapshotItems(null);
    void apiFetch<RestoreSnapshotItems>("/api/admin/backups/restore/items", {
      method: "POST",
      body: JSON.stringify({ backupId: selectedBackupId }),
    })
      .then((items) => {
        if (!cancelled) setSnapshotItems(items);
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshotItems(null);
          setRestoreError(t("admin.backups.restoreItemsError"));
        }
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsItems, selectedBackupId, t]);

  function previewBody(): Record<string, unknown> | null {
    if (!selectedBackupId) return null;
    if (restoreMode === "sections") {
      if (!selectedCategories.length) return null;
      return {
        mode: "sections",
        backupId: selectedBackupId,
        categories: selectedCategories,
      };
    }
    if (restoreMode === "full") {
      return { mode: "full", backupId: selectedBackupId };
    }
    if (restoreMode === "customPage") {
      if (!selectedPageId) return null;
      return { mode: "customPage", backupId: selectedBackupId, pageId: selectedPageId };
    }
    if (restoreMode === "product") {
      if (!selectedProductId) return null;
      return {
        mode: "product",
        backupId: selectedBackupId,
        productId: selectedProductId,
        membershipPolicy,
      };
    }
    if (!selectedCategoryIds.length) return null;
    return {
      mode: "categoryWithProducts",
      backupId: selectedBackupId,
      categoryIds: selectedCategoryIds,
      membershipPolicy,
    };
  }

  const openPreview = useCallback(async () => {
    const body = previewBody();
    if (!body || previewing) return;
    setPreviewing(true);
    setRestoreError("");
    setConfirmOpen(false);
    try {
      const result = await apiFetch<RestorePreviewResult>(
        "/api/admin/backups/restore/preview",
        { method: "POST", body: JSON.stringify(body) },
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
  }, [
    previewing,
    restoreMode,
    selectedBackupId,
    selectedCategories,
    selectedCategoryIds,
    selectedPageId,
    selectedProductId,
    membershipPolicy,
    t,
  ]);

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
            mode: preview.mode,
            categories: preview.categories,
            pageId: preview.details.pages?.[0]?.id,
            productId: preview.details.products?.[0]?.id,
            categoryIds: preview.details.categories?.map((item) => item.id),
            membershipPolicy: preview.details.membershipPolicy,
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
      } else if (err instanceof ApiError && err.status === 503) {
        setRestoreError(t("admin.backups.restoreMediaFailed"));
      } else {
        setRestoreError(
          err instanceof Error ? err.message : t("admin.backups.restoreError"),
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [liveRestoreAllowed, load, notifySaved, preview, restoring, t]);

  const runRollbackPreview = useCallback(async () => {
    if (!data?.rollback || previewing) return;
    setPreviewing(true);
    setRestoreError("");
    try {
      const result = await apiFetch<RestorePreviewResult>(
        "/api/admin/backups/restore/preview",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "rollback",
            backupId: data.rollback.id,
          }),
        },
      );
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setRestoreError(
        err instanceof Error ? err.message : t("admin.backups.restorePreviewError"),
      );
    } finally {
      setPreviewing(false);
    }
  }, [data?.rollback, previewing, t]);

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
          <button
            type="button"
            className="admin-backups-now admin-backups-all"
            disabled={githubCreating || !githubBackupAllowed}
            onClick={() => void createGithubBackup()}
          >
            <Archive size={16} strokeWidth={1.8} aria-hidden />
            <span>
              {githubCreating
                ? t("admin.backups.backupAllRunning")
                : t("admin.backups.backupAll")}
            </span>
          </button>
          {githubError ? (
            <p className="admin-backups-action-error" role="alert">
              {githubError}
            </p>
          ) : githubBackupAllowed ? (
            <p>{t("admin.backups.backupAllHint")}</p>
          ) : (
            <p className="admin-backups-restore-prod-only" role="status">
              {t("admin.backups.backupAllProductionOnly")}
            </p>
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

      {githubBackupAllowed ? (
        <section className="admin-backups-card admin-backups-github-history">
          <div className="admin-backups-section-head">
            <div>
              <Archive size={16} strokeWidth={1.7} aria-hidden />
              <h2>{t("admin.backups.githubHistoryTitle")}</h2>
            </div>
            <span className="admin-backups-more is-static">
              {t("admin.backups.githubRetention", {
                days: githubStatus?.retentionDays ?? 30,
              })}
            </span>
          </div>
          <p className="admin-backups-lead">
            {githubStatus?.lastRun
              ? `${t("admin.backups.githubLastRun")} ${formatBackupDateTime(githubStatus.lastRun.createdAt)} — ${
                  githubStatus.lastRun.complete
                    ? t("admin.backups.githubComplete")
                    : t("admin.backups.githubIncomplete")
                } · ${
                  githubStatus.lastRun.remainingMedia === 0 && githubStatus.lastRun.failed === 0
                    ? t("admin.backups.githubMediaDone")
                    : t("admin.backups.githubMediaPending")
                }`
              : t("admin.backups.githubNone")}
          </p>
          {githubStatus?.snapshots.length ? (
            <ul className="admin-backups-github-dates">
              {githubStatus.snapshots
                .slice()
                .reverse()
                .slice(0, 30)
                .map((row) => (
                  <li key={row.date}>
                    <strong>{row.date}</strong>
                    <span>
                      {row.complete && row.verified
                        ? t("admin.backups.githubComplete")
                        : t("admin.backups.githubIncomplete")}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}

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
          <ul className="admin-backups-restore-modes">
            {RESTORE_MODES.map((item) => {
              const Icon = item.icon;
              const active = restoreMode === item.key;
              const label =
                item.key === "sections"
                  ? t("admin.backups.restoreModeSections")
                  : item.key === "full"
                    ? t("admin.backups.restoreModeFull")
                    : item.key === "customPage"
                      ? t("admin.backups.restoreModePage")
                      : item.key === "product"
                        ? t("admin.backups.restoreModeProduct")
                        : t("admin.backups.restoreModeCategory");
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={active ? "is-active" : undefined}
                    onClick={() => {
                      setRestoreMode(item.key);
                      setRestoreError("");
                    }}
                  >
                    <Icon size={14} strokeWidth={1.7} aria-hidden />
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {restoreMode === "sections" ? (
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
          ) : null}
          {restoreMode === "full" ? (
            <p className="admin-backups-restore-note">
              {t("admin.backups.restoreFullWarn")}
            </p>
          ) : null}
          {needsItems ? (
            <RestoreItemPicker
              mode={restoreMode}
              loading={itemsLoading}
              items={snapshotItems}
              query={itemQuery}
              pageId={selectedPageId}
              productId={selectedProductId}
              categoryIds={selectedCategoryIds}
              t={t}
              onQuery={setItemQuery}
              onPage={setSelectedPageId}
              onProduct={setSelectedProductId}
              onCategories={setSelectedCategoryIds}
            />
          ) : null}
          {restoreMode === "categoryWithProducts" || restoreMode === "product" ? (
            <div className="admin-backups-membership">
              <p className="admin-backups-restore-note">
                {t("admin.backups.restoreMembershipHint")}
              </p>
              <label>
                <input
                  type="radio"
                  name="restore-membership"
                  checked={membershipPolicy === "preserve-live"}
                  onChange={() => setMembershipPolicy("preserve-live")}
                />
                <span>{t("admin.backups.restoreMembershipPreserve")}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="restore-membership"
                  checked={membershipPolicy === "backup-exact"}
                  onChange={() => setMembershipPolicy("backup-exact")}
                />
                <span>{t("admin.backups.restoreMembershipExact")}</span>
              </label>
            </div>
          ) : null}
          {data?.rollback ? (
            <button
              type="button"
              className="admin-backups-rollback"
              disabled={previewing || restoring}
              onClick={() => void runRollbackPreview()}
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden />
              <span>{t("admin.backups.restoreRollback")}</span>
            </button>
          ) : (
            <p className="admin-backups-restore-note">
              {t("admin.backups.restoreRollbackNone")}
            </p>
          )}
          {data?.rollback ? (
            <p className="admin-backups-restore-note">
              {t("admin.backups.restoreRollbackHint")}{" "}
              {formatBackupDateTime(data.rollback.createdAt)}
            </p>
          ) : null}
          {data?.rollback ? (
            <p className="admin-restore-warning admin-backups-inline-warn">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden />
              {t("admin.backups.restoreRollbackWarn")}
            </p>
          ) : null}
          {restoreError ? (
            <p className="admin-backups-action-error" role="alert">
              {restoreError}
            </p>
          ) : null}
          <button
            type="button"
            className="admin-backups-restore-go"
            disabled={!previewBody() || previewing || restoring}
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

function modeLabel(
  mode: RestoreMode,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (mode === "full") return t("admin.backups.restoreModeFull");
  if (mode === "customPage") return t("admin.backups.restoreModePage");
  if (mode === "product") return t("admin.backups.restoreModeProduct");
  if (mode === "categoryWithProducts") return t("admin.backups.restoreModeCategory");
  if (mode === "rollback") return t("admin.backups.restoreRollback");
  return t("admin.backups.restoreModeSections");
}

function warningFor(
  preview: RestorePreviewResult,
  t: (key: string) => string,
) {
  if (preview.mode === "rollback") return t("admin.backups.restoreRollbackWarn");
  if (preview.mode === "full") return t("admin.backups.restoreFullWarn");
  if (preview.mode === "customPage") return t("admin.backups.restorePageWarn");
  if (preview.mode === "product") return t("admin.backups.restoreProductWarn");
  if (preview.mode === "categoryWithProducts") {
    return t("admin.backups.restoreCategoryWarn");
  }
  return t("admin.backups.restoreWarning");
}

function RestoreItemPicker({
  mode,
  loading,
  items,
  query,
  pageId,
  productId,
  categoryIds,
  t,
  onQuery,
  onPage,
  onProduct,
  onCategories,
}: {
  mode: Exclude<RestoreMode, "rollback" | "sections" | "full">;
  loading: boolean;
  items: RestoreSnapshotItems | null;
  query: string;
  pageId: string | null;
  productId: string | null;
  categoryIds: string[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  onQuery: (value: string) => void;
  onPage: (id: string) => void;
  onProduct: (id: string) => void;
  onCategories: (ids: string[]) => void;
}) {
  const needle = query.trim().toLowerCase();
  const hint =
    mode === "customPage"
      ? t("admin.backups.restorePickPage")
      : mode === "product"
        ? t("admin.backups.restorePickProduct")
        : t("admin.backups.restorePickCategory");
  const rows =
    mode === "customPage"
      ? (items?.pages || [])
          .filter((item) =>
            !needle
              ? true
              : `${item.name} ${item.slug}`.toLowerCase().includes(needle),
          )
          .map((item) => ({ id: item.id, label: `${item.name} · ${item.slug}` }))
      : mode === "product"
        ? (items?.products || [])
            .filter((item) =>
              !needle
                ? true
                : `${item.name} ${item.sku}`.toLowerCase().includes(needle),
            )
            .map((item) => ({
              id: item.id,
              label: `${item.name}${item.sku ? ` · ${item.sku}` : ""}`,
            }))
        : (items?.categories || [])
            .filter((item) =>
              !needle
                ? true
                : `${item.name} ${item.names.ar} ${item.names.he} ${item.names.en}`
                    .toLowerCase()
                    .includes(needle),
            )
            .map((item) => ({
              id: item.id,
              label: `${item.name} · ${item.productCount}`,
            }));

  return (
    <div className="admin-backups-item-picker">
      <p className="admin-backups-restore-note">{hint}</p>
      <input
        className="admin-backups-item-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("admin.backups.restoreSearchItems")}
      />
      {loading ? (
        <p className="admin-backups-restore-note">{t("admin.backups.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="admin-backups-restore-note">{t("admin.backups.restoreItemsEmpty")}</p>
      ) : (
        <ul className="admin-backups-item-list">
          {rows.map((row) => {
            const active =
              mode === "categoryWithProducts"
                ? categoryIds.includes(row.id)
                : mode === "customPage"
                  ? pageId === row.id
                  : productId === row.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className={active ? "is-active" : undefined}
                  onClick={() => {
                    if (mode === "categoryWithProducts") {
                      onCategories(
                        categoryIds.includes(row.id)
                          ? categoryIds.filter((id) => id !== row.id)
                          : [...categoryIds, row.id],
                      );
                      return;
                    }
                    if (mode === "customPage") onPage(row.id);
                    else onProduct(row.id);
                  }}
                >
                  {row.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChangeList({
  items,
  t,
}: {
  items?: RestoreChangeItem[];
  t: (key: string) => string;
}) {
  if (!items?.length) return null;
  return (
    <ul className="admin-restore-changes">
      {items.map((item) => (
        <li key={item.id} className={item.overwrite ? "is-overwrite" : undefined}>
          <strong>{item.label}</strong>
          <span>
            {item.action === "add"
              ? t("admin.backups.restoreChangeAdd")
              : item.action === "update"
                ? t("admin.backups.restoreChangeUpdate")
                : t("admin.backups.restoreChangeKeep")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OverwriteList({
  preview,
  t,
}: {
  preview: RestorePreviewResult;
  t: (key: string) => string;
}) {
  const overwritten = [
    ...(preview.details.categories || []).filter((item) => item.overwrite),
    ...(preview.details.products || []).filter((item) => item.overwrite),
    ...(preview.details.pages || []).filter((item) => item.overwrite),
  ];
  if (!overwritten.length) return null;
  return (
    <div className="admin-restore-overwrite">
      <p className="admin-restore-warning">
        <AlertTriangle size={15} strokeWidth={2} aria-hidden />
        {t("admin.backups.restoreOverwriteWarn")}
      </p>
      <p className="admin-restore-meta">{t("admin.backups.restoreOverwriteTitle")}</p>
      <ul className="admin-restore-changes">
        {overwritten.map((item) => (
          <li key={item.id} className="is-overwrite">
            <strong>{item.label}</strong>
            <span>{t("admin.backups.restoreChangeUpdate")}</span>
          </li>
        ))}
      </ul>
    </div>
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
  t: (key: string, vars?: Record<string, string | number>) => string;
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
          {modeLabel(preview.mode, t)} · {formatBackupDateTime(preview.backup.createdAt)} —{" "}
          {preview.backup.kind === "manual"
            ? t("admin.backups.kindManual")
            : preview.backup.kind === "pre-restore"
              ? t("admin.backups.restoreRollback")
              : t("admin.backups.kindDaily")}
        </p>
        {preview.sections.length ? (
          <ul className="admin-restore-sections">
            {preview.sections.map((section) => (
              <li key={section.category}>
                <strong>
                  {section.category.startsWith("restore_")
                    ? section.category
                    : t(`admin.backups.restore_${section.category}`)}
                </strong>
                <span>
                  {t("admin.backups.restoreLiveCount")} {section.liveCount}
                </span>
                <span>
                  {t("admin.backups.restoreBackupCount")} {section.backupCount}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ChangeList items={preview.details.categories} t={t} />
        <ChangeList items={preview.details.pages} t={t} />
        <ChangeList items={preview.details.products} t={t} />
        <OverwriteList preview={preview} t={t} />
        {preview.details.lostMemberships?.length ? (
          <div className="admin-restore-overwrite">
            <p className="admin-restore-warning">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden />
              {t("admin.backups.restoreLostMemberships")}
            </p>
            <ul className="admin-restore-changes">
              {preview.details.lostMemberships.map((item) => (
                <li key={item.productId} className="is-overwrite">
                  <strong>{item.productLabel}</strong>
                  <span>{item.categoryIds.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="admin-restore-meta">
          {t("admin.backups.restoreMediaCounts", {
            referenced: preview.media.referenced,
            already: preview.media.alreadyPresent,
            restore: preview.media.willRestore,
          })}
        </p>
        <p className="admin-restore-warning">
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          {warningFor(preview, t)}
        </p>
        <p className="admin-restore-meta">{t("admin.backups.restoreMediaNote")}</p>
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
