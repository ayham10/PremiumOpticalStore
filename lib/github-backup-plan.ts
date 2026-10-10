import { createHash } from "crypto";
import { collectReferencedMediaPaths } from "@/lib/restore-media";
import type { AppData } from "@/lib/types";

export const GITHUB_BACKUP_PREFIX = "backups/";
export const GITHUB_DATABASE_PATH = `${GITHUB_BACKUP_PREFIX}database.json`;
export const GITHUB_MEDIA_PREFIX = `${GITHUB_BACKUP_PREFIX}media/`;
export const GITHUB_INDEX_PATH = `${GITHUB_BACKUP_PREFIX}media-index.json`;
export const GITHUB_INFO_PATH = `${GITHUB_BACKUP_PREFIX}backup-info.json`;
export const GITHUB_HISTORY_PATH = `${GITHUB_BACKUP_PREFIX}history.json`;
export const GITHUB_DAILY_PREFIX = `${GITHUB_BACKUP_PREFIX}daily/`;
export const GITHUB_SNAPSHOT_FORMAT = 1 as const;
export const DEFAULT_GITHUB_RETENTION_DAYS = 30;

const SECRET_KEY =
  /password|secret|api[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key|client[_-]?secret|session[_-]?data/i;

export type GithubDailyManifest = {
  kind: "oyon-github-daily-manifest";
  version: typeof GITHUB_SNAPSHOT_FORMAT;
  date: string;
  createdAt: string;
  complete: boolean;
  verified: boolean;
  appDataSha256: string | null;
  snapshotPath: string | null;
  mediaFileCount: number;
  missingMedia: number;
  failedMedia: number;
  tooLargeMedia: number;
  externalMediaCount: number;
  retentionDays: number;
};

export type GithubHistorySnapshot = {
  date: string;
  createdAt: string;
  complete: boolean;
  verified: boolean;
  appDataSha256: string | null;
  mediaFileCount: number;
  missingMedia: number;
  failedMedia: number;
};

export type GithubBackupIncompleteReason =
  | "timeout"
  | "media_failed"
  | "too_large"
  | "incomplete";

export type GithubHistoryLastRun = {
  createdAt: string;
  complete: boolean;
  timedOut: boolean;
  remainingMedia: number;
  copied: number;
  skipped: number;
  failed: number;
  tooLarge: number;
  mediaFileCount: number;
  reason: GithubBackupIncompleteReason | null;
};

export function githubBackupIncompleteReason(info: {
  complete: boolean;
  timedOut: boolean;
  failed: number;
  tooLarge: number;
  remainingMedia: number;
}): GithubBackupIncompleteReason | null {
  if (info.complete) return null;
  if (info.tooLarge > 0) return "too_large";
  if (info.failed > 0) return "media_failed";
  if (info.timedOut || info.remainingMedia > 0) return "timeout";
  return "incomplete";
}

export type GithubBackupHistory = {
  version: 1;
  retentionDays: number;
  lastRun: GithubHistoryLastRun | null;
  snapshots: GithubHistorySnapshot[];
};

export function githubBackupRetentionDays(
  raw: string | undefined = process.env.GITHUB_BACKUP_RETENTION_DAYS,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_GITHUB_RETENTION_DAYS;
  return Math.min(365, Math.max(1, Math.floor(parsed)));
}

export function githubBackupDate(
  iso: string,
  timeZone = "Asia/Jerusalem",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error("GITHUB_BACKUP_DATE_INVALID");
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function githubDailySnapshotPath(date: string): string {
  return `${GITHUB_DAILY_PREFIX}${date}.json`;
}

export function githubDailyManifestPath(date: string): string {
  return `${GITHUB_DAILY_PREFIX}${date}.manifest.json`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Json(value: unknown): string {
  return sha256Bytes(new Uint8Array(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")));
}

export function verifyChecksum(bytes: Uint8Array, expected: string): boolean {
  return Boolean(expected) && sha256Bytes(bytes) === expected;
}

export function redactBackupSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) && typeof item === "string") {
      out[key] = "";
      continue;
    }
    out[key] = redactValue(item);
  }
  return out;
}

export function validateGithubSnapshot(data: unknown): AppData {
  if (!data || typeof data !== "object") {
    throw new Error("GITHUB_BACKUP_INVALID_STORE");
  }
  const app = data as AppData;
  if (!Array.isArray(app.products) || !app.settings || typeof app.settings !== "object") {
    throw new Error("GITHUB_BACKUP_INVALID_STORE");
  }
  return app;
}

export function collectExternalMediaUrls(data: unknown): string[] {
  const found: string[] = [];
  walkStrings(data, (value) => {
    if (!/^https?:\/\//i.test(value)) return;
    if (value.includes("/lumina-media/")) return;
    found.push(value);
  });
  return [...new Set(found)].sort();
}

function walkStrings(value: unknown, visit: (value: string) => void) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

export function parseGithubHistory(value: unknown): GithubBackupHistory {
  if (!value || typeof value !== "object") {
    return { version: 1, retentionDays: DEFAULT_GITHUB_RETENTION_DAYS, lastRun: null, snapshots: [] };
  }
  const raw = value as Partial<GithubBackupHistory>;
  const snapshots = Array.isArray(raw.snapshots)
    ? raw.snapshots.filter(isHistorySnapshot)
    : [];
  return {
    version: 1,
    retentionDays:
      typeof raw.retentionDays === "number"
        ? githubBackupRetentionDays(String(raw.retentionDays))
        : DEFAULT_GITHUB_RETENTION_DAYS,
    lastRun: parseLastRun(raw.lastRun),
    snapshots: snapshots.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function parseLastRun(value: unknown): GithubHistoryLastRun | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<GithubHistoryLastRun>;
  if (typeof raw.createdAt !== "string") return null;
  const failed = Number(raw.failed) || 0;
  const tooLarge = Number(raw.tooLarge) || 0;
  const remainingMedia = Number(raw.remainingMedia) || 0;
  const timedOut = Boolean(raw.timedOut);
  const complete = raw.complete === true;
  return {
    createdAt: raw.createdAt,
    complete,
    timedOut,
    remainingMedia,
    copied: Number(raw.copied) || 0,
    skipped: Number(raw.skipped) || 0,
    failed,
    tooLarge,
    mediaFileCount: Number(raw.mediaFileCount) || 0,
    reason:
      raw.reason === "timeout" ||
      raw.reason === "media_failed" ||
      raw.reason === "too_large" ||
      raw.reason === "incomplete"
        ? raw.reason
        : githubBackupIncompleteReason({
            complete,
            timedOut,
            failed,
            tooLarge,
            remainingMedia,
          }),
  };
}

function isHistorySnapshot(value: unknown): value is GithubHistorySnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GithubHistorySnapshot>;
  return typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date);
}

export function retentionCutoffDate(today: string, retentionDays: number): string {
  const [year, month, day] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - retentionDays);
  return utc.toISOString().slice(0, 10);
}

export function planDailyRetention(
  snapshots: GithubHistorySnapshot[],
  today: string,
  retentionDays: number,
): { keep: GithubHistorySnapshot[]; deleteDates: string[] } {
  const valid = snapshots
    .filter((item) => item.complete && item.verified)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!valid.length) return { keep: snapshots, deleteDates: [] };

  const newest = valid[valid.length - 1];
  const cutoff = retentionCutoffDate(today, retentionDays);
  const deleteDates: string[] = [];
  const keep: GithubHistorySnapshot[] = [];

  for (const item of snapshots) {
    const expiredValid =
      item.complete &&
      item.verified &&
      item.date !== newest.date &&
      item.date <= cutoff;
    if (expiredValid) {
      deleteDates.push(item.date);
      continue;
    }
    keep.push(item);
  }
  return { keep, deleteDates: [...new Set(deleteDates)] };
}

export function retentionDeletePaths(dates: string[]): string[] {
  return dates.flatMap((date) => [
    githubDailySnapshotPath(date),
    githubDailyManifestPath(date),
  ]);
}

export function mediaRequiredBySnapshots(snapshots: unknown[]): string[] {
  const paths = new Set<string>();
  for (const snapshot of snapshots) {
    for (const path of collectReferencedMediaPaths(snapshot)) paths.add(path);
  }
  return [...paths].sort();
}

export function upsertHistorySnapshot(
  history: GithubBackupHistory,
  snapshot: GithubHistorySnapshot,
): GithubBackupHistory {
  const others = history.snapshots.filter((item) => item.date !== snapshot.date);
  return {
    ...history,
    snapshots: [...others, snapshot].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function clientSafeHistory(history: GithubBackupHistory) {
  return {
    retentionDays: history.retentionDays,
    lastRun: history.lastRun,
    snapshots: history.snapshots.map((item) => ({
      date: item.date,
      createdAt: item.createdAt,
      complete: item.complete,
      verified: item.verified,
      appDataSha256: item.appDataSha256,
      mediaFileCount: item.mediaFileCount,
      missingMedia: item.missingMedia,
      failedMedia: item.failedMedia,
    })),
  };
}

export type GithubRecoveryCheck = {
  ok: boolean;
  errors: string[];
  date: string | null;
  verified: boolean;
};

export function validateGithubRecoveryPoint(
  snapshot: unknown,
  manifest: unknown,
  snapshotBytes?: Uint8Array,
): GithubRecoveryCheck {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== "object") {
    return { ok: false, errors: ["GITHUB_RECOVERY_MANIFEST_MISSING"], date: null, verified: false };
  }
  const info = manifest as Partial<GithubDailyManifest>;
  if (info.kind !== "oyon-github-daily-manifest") {
    errors.push("GITHUB_RECOVERY_MANIFEST_INVALID");
  }
  if (info.complete !== true || info.verified !== true) {
    errors.push("GITHUB_RECOVERY_NOT_COMPLETE");
  }
  try {
    validateGithubSnapshot(snapshot);
  } catch {
    errors.push("GITHUB_RECOVERY_SNAPSHOT_INVALID");
  }
  if (!info.appDataSha256) {
    errors.push("GITHUB_RECOVERY_CHECKSUM_MISSING");
  } else if (snapshotBytes && !verifyChecksum(snapshotBytes, info.appDataSha256)) {
    errors.push("GITHUB_RECOVERY_CHECKSUM_MISMATCH");
  } else if (!snapshotBytes && snapshot && info.appDataSha256 !== sha256Json(snapshot)) {
    errors.push("GITHUB_RECOVERY_CHECKSUM_MISMATCH");
  }
  return {
    ok: errors.length === 0,
    errors,
    date: typeof info.date === "string" ? info.date : null,
    verified: errors.length === 0,
  };
}
