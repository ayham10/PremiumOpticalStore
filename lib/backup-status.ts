/** Client-safe backup summary types. No storage paths, URLs, or secrets. */

/**
 * `failed` is reserved for a confirmed unsuccessful backup attempt.
 * The current read-only API only sees completed daily JSON snapshots, so it
 * cannot distinguish a failed cron run from a late/missing snapshot and
 * never emits `failed`.
 */
export type BackupHealthStatus = "healthy" | "warning" | "failed" | "none";
export type BackupRowStatus = "success" | "warning" | "failed";
export type BackupHistoryKind = "daily" | "manual";

export type BackupHistoryItem = {
  kind: BackupHistoryKind;
  date: string;
  createdAt: string;
  sizeBytes: number;
  appointments: number | null;
  products: number | null;
  lensInventory: number | null;
  customers: number | null;
  promotions: number | null;
  settingsIncluded: boolean;
  mediaObjectCount: number | null;
  status: BackupRowStatus;
};

/** Client-safe POST /api/admin/backups result. No paths, URLs, or secrets. */
export type ManualBackupClientResult = {
  ok: boolean;
  complete: boolean;
  timedOut: boolean;
  remainingMedia: number;
  purpose: "manual";
  createdAt: string;
  media: {
    copied: number;
    alreadyPresent: number;
    skippedUnchanged: number;
    failed: number;
    liveObjectCount: number;
  };
};

export type BackupStatusSummary = {
  status: BackupHealthStatus;
  retentionDays: number;
  automatic: {
    enabled: boolean;
    schedule: "daily";
    timeUtc: "00:00";
    localTimeZone: "Asia/Jerusalem";
    localTime: string;
  };
  latest: BackupHistoryItem | null;
  lastSuccessful: BackupHistoryItem | null;
  history: BackupHistoryItem[];
  media: {
    protectedCount: number | null;
    incremental: true;
    lastSyncedAt: string | null;
  };
};

export function formatBackupBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatBackupDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate || "—";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatBackupTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatBackupDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${formatBackupDate(day)} • ${formatBackupTime(iso)}`;
}
