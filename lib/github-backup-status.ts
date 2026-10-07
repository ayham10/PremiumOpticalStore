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
};

/** Client-safe: Vercel inlines NEXT_PUBLIC_VERCEL_ENV at build time. */
export function isGithubBackupUiAllowed(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
