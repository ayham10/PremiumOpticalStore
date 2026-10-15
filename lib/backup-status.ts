/** Client-safe backup summary types. No storage paths, URLs, or secrets. */

export type BackupHealthStatus = "healthy" | "warning" | "failed" | "none";
export type BackupRowStatus = "success" | "warning" | "failed";
export type BackupHistoryKind = "daily" | "manual";
export type BackupRunPurpose = "daily" | "manual" | "pre-restore";

/** Client-safe last backup attempt. No storage paths, URLs, or error text. */
export type BackupLastRun = {
  createdAt: string;
  date: string;
  purpose: BackupRunPurpose;
  ok: boolean;
  complete: boolean;
  timedOut: boolean;
  remainingMedia: number;
  failedMedia: number;
  snapshotWritten: boolean;
};

export type BackupHistoryItem = {
  id: string;
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
  /** Store JSON is restorable. `warning` means media copy was incomplete. */
  status: BackupRowStatus;
  complete: boolean;
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
  lastRun: BackupLastRun | null;
  history: BackupHistoryItem[];
  media: {
    protectedCount: number | null;
    incremental: true;
    lastSyncedAt: string | null;
  };
  rollback: {
    id: string;
    createdAt: string;
  } | null;
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

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/**
 * Automatic backup health from completed daily JSON + last-run receipt.
 * `failed` = last run crashed, or no complete daily for 3+ Israel calendar days.
 * `warning` = complete daily is two days old, or today's run wrote JSON but media timed out.
 * `healthy` = complete daily today or yesterday, and today's run (if any) finished media.
 */
export function computeBackupHealthStatus(input: {
  today: string;
  latestCompleteDailyDate: string | null;
  lastRun: Pick<BackupLastRun, "ok" | "complete" | "date"> | null;
}): BackupHealthStatus {
  const yesterday = shiftIsoDate(input.today, -1);
  const failedCutoff = shiftIsoDate(input.today, -2);
  const lastRun = input.lastRun;

  if (lastRun && lastRun.ok === false) return "failed";

  if (!input.latestCompleteDailyDate) {
    if (lastRun?.complete === false) return "warning";
    return "none";
  }

  if (input.latestCompleteDailyDate < failedCutoff) return "failed";
  if (input.latestCompleteDailyDate < yesterday) return "warning";
  if (lastRun && lastRun.date === input.today && lastRun.complete === false) {
    return "warning";
  }
  return "healthy";
}

export function snapshotHistoryStatus(complete: boolean | undefined): BackupRowStatus {
  return complete === false ? "warning" : "success";
}

export function lastSuccessfulHistoryItem(
  history: BackupHistoryItem[],
): BackupHistoryItem | null {
  return history.find((item) => item.status === "success") ?? null;
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
