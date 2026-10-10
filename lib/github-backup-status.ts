/** Client-safe GitHub disaster-backup types. No tokens, owners, repos, or URLs. */

export type GithubBackupPurpose = "admin-all";

export type GithubBackupClientResult = {
  ok: boolean;
  complete: boolean;
  timedOut: boolean;
  remainingMedia: number;
  purpose: GithubBackupPurpose;
  createdAt: string;
  appDataSha256: string | null;
  githubCommitSha: string | null;
  liveMediaCount: number;
  currentLivePresentOnGithub: number;
  githubProtectedCount: number;
  copied: number;
  skipped: number;
  failed: number;
  tooLarge: number;
  date: string;
  retentionDays: number;
  verified: boolean;
  dailySnapshotPath: string | null;
  externalMediaCount: number;
  historyCount: number;
};

export type GithubBackupStatusSummary = {
  enabled: boolean;
  retentionDays: number;
  lastRun: {
    createdAt: string;
    complete: boolean;
    timedOut: boolean;
    remainingMedia: number;
    copied: number;
    failed: number;
    tooLarge: number;
    mediaFileCount: number;
  } | null;
  snapshots: Array<{
    date: string;
    createdAt: string;
    complete: boolean;
    verified: boolean;
    appDataSha256: string | null;
    mediaFileCount: number;
    missingMedia: number;
    failedMedia: number;
  }>;
};

/** Client-safe: Vercel inlines NEXT_PUBLIC_VERCEL_ENV at build time. */
export function isGithubBackupUiAllowed(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
