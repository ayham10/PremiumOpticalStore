import { createHash } from "crypto";
import {
  type GithubBackupClientResult,
  type GithubBackupPurpose,
} from "@/lib/github-backup-status";
import { MEDIA_BUCKET, supabaseServerConfig } from "@/lib/storage";
import type { AppData } from "@/lib/types";

const BACKUP_BUCKET =
  process.env.SUPABASE_BACKUP_BUCKET?.trim() || "oyon-backups";

const MEDIA_OBJECT_PREFIX = "media/objects/";
const GITHUB_PREFIX = "backups/";
const GITHUB_DATABASE_PATH = `${GITHUB_PREFIX}database.json`;
const GITHUB_MEDIA_PREFIX = `${GITHUB_PREFIX}media/`;
const GITHUB_INDEX_PATH = `${GITHUB_PREFIX}media-index.json`;
const GITHUB_INFO_PATH = `${GITHUB_PREFIX}backup-info.json`;
const GITHUB_BOOTSTRAP_PATH = `${GITHUB_PREFIX}.keep`;
/** Stop starting new copies before Vercel kills the function (maxDuration 60s). */
const GITHUB_TIME_BUDGET_MS = 45_000;
/** GitHub git-blob hard limit. */
const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024;
const STORE_TABLE = process.env.SUPABASE_STORE_TABLE || "lumina_store";
const STORE_ID = process.env.SUPABASE_STORE_ID || "default";

let githubBackupInFlight = false;

export type LiveMediaObject = {
  path: string;
  size: number;
  updatedAt: string | null;
};

export type GithubMediaIndex = {
  version: 1;
  objects: Record<
    string,
    { size: number; updatedAt: string | null; backedUpAt: string }
  >;
};

export type GithubBackupInfo = {
  complete: boolean;
  createdAt: string;
  purpose: GithubBackupPurpose;
  appDataSha256: string | null;
  store: {
    table: string;
    id: string;
    updatedAt: string | null;
    payloadBytes: number;
  };
  liveMediaCount: number;
  currentLivePresentOnGithub: number;
  githubProtectedCount: number;
  copied: number;
  skipped: number;
  failed: number;
  tooLarge: string[];
  githubCommitSha: string | null;
  timedOut: boolean;
  remainingMedia: number;
};

export type GithubCommitFile = {
  path: string;
  bytes: Uint8Array;
};

export type GithubRepoClient = {
  probeRepository: () => Promise<void>;
  readJsonFile: (path: string) => Promise<unknown | null>;
  commitFiles: (files: GithubCommitFile[], message: string) => Promise<string>;
};

export type GithubBackupDependencies = {
  vercelEnv?: string;
  now?: () => number;
  timeBudgetMs?: number;
  readLive: () => Promise<{
    payload: AppData;
    updatedAt: string | null;
    payloadBytes: number;
  }>;
  listLiveMedia: () => Promise<LiveMediaObject[]>;
  downloadProtected: (
    livePath: string,
  ) => Promise<{ bytes: Uint8Array; contentType: string } | null>;
  downloadLive: (
    livePath: string,
  ) => Promise<{ bytes: Uint8Array; contentType: string }>;
  github: GithubRepoClient;
};

export function isGithubBackupAllowed(
  env: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return env === "production";
}

type GithubEnvConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export function isAbsentStorageStatus(status: number): boolean {
  return status === 400 || status === 404;
}

function githubEnvConfig(): GithubEnvConfig {
  const token = process.env.GITHUB_BACKUP_TOKEN?.trim() || "";
  const owner = process.env.GITHUB_BACKUP_OWNER?.trim() || "";
  const repo = process.env.GITHUB_BACKUP_REPO?.trim() || "";
  const branch = process.env.GITHUB_BACKUP_BRANCH?.trim() || "main";
  if (!token || !owner || !repo) {
    throw new Error("GITHUB_BACKUP_NOT_CONFIGURED");
  }
  return { token, owner, repo, branch };
}

function requireStorageConfig() {
  const config = supabaseServerConfig();
  if (!config) {
    throw new Error("Supabase is not configured; cannot run GitHub backup");
  }
  return config;
}

function storageHeaders(
  config: NonNullable<ReturnType<typeof supabaseServerConfig>>,
) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
  };
}

function joinPath(...parts: string[]) {
  return parts
    .map((part, index) =>
      index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

function githubMediaPath(livePath: string): string {
  return joinPath(GITHUB_MEDIA_PREFIX, livePath);
}

function protectedObjectPath(livePath: string): string {
  return joinPath(MEDIA_OBJECT_PREFIX, livePath);
}

function hashAppData(data: AppData): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function emptyIndex(): GithubMediaIndex {
  return { version: 1, objects: {} };
}

function parseIndex(value: unknown): GithubMediaIndex {
  if (!value || typeof value !== "object") return emptyIndex();
  const record = value as Partial<GithubMediaIndex>;
  if (record.version !== 1 || !record.objects || typeof record.objects !== "object") {
    return emptyIndex();
  }
  return { version: 1, objects: { ...record.objects } };
}

function indexMatches(
  object: LiveMediaObject,
  index: GithubMediaIndex,
): boolean {
  const known = index.objects[object.path];
  return Boolean(
    known &&
      known.size === object.size &&
      (known.updatedAt || "") === (object.updatedAt || ""),
  );
}

async function listLiveMediaDefault(): Promise<LiveMediaObject[]> {
  const config = requireStorageConfig();
  const out: LiveMediaObject[] = [];
  const queue = [""];

  while (queue.length) {
    const current = queue.shift() ?? "";
    let offset = 0;
    for (;;) {
      const response = await fetch(
        `${config.url}/storage/v1/object/list/${MEDIA_BUCKET}`,
        {
          method: "POST",
          headers: {
            ...storageHeaders(config),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefix: current,
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error(`GITHUB_BACKUP_MEDIA_LIST_FAILED:${response.status}`);
      }
      const page = (await response.json()) as Array<{
        name: string;
        id: string | null;
        updated_at?: string;
        metadata?: { size?: number };
      }>;
      if (!page.length) break;
      for (const item of page) {
        const path = joinPath(current, item.name);
        if (!item.id) {
          queue.push(path);
          continue;
        }
        out.push({
          path,
          size: Number(item.metadata?.size ?? 0) || 0,
          updatedAt: item.updated_at ?? null,
        });
      }
      if (page.length < 1000) break;
      offset += 1000;
    }
  }

  return out;
}

export async function downloadStorageObject(
  bucket: string,
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const config = requireStorageConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${bucket}/${path}`,
    { headers: storageHeaders(config), cache: "no-store" },
  );
  if (isAbsentStorageStatus(response.status)) return null;
  if (!response.ok) {
    throw new Error(`GITHUB_BACKUP_MEDIA_DOWNLOAD_FAILED:${response.status}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function downloadProtectedDefault(livePath: string) {
  return downloadStorageObject(BACKUP_BUCKET, protectedObjectPath(livePath));
}

async function downloadLiveDefault(livePath: string) {
  const file = await downloadStorageObject(MEDIA_BUCKET, livePath);
  if (!file) {
    throw new Error("GITHUB_BACKUP_LIVE_MEDIA_MISSING");
  }
  return file;
}

type GithubApiResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

type GithubApiKind = "repo" | "file" | "ref" | "write";

function redactGithubSecrets(value: string): string {
  return value
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/ghp_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/gho_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/ghu_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/ghs_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function githubResponseMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const message = (data as { message?: unknown }).message;
  if (typeof message !== "string") return "";
  return redactGithubSecrets(message.replace(/\s+/g, " ").trim()).slice(0, 200);
}

export function formatGithubBackupDiagnostic(
  method: string,
  path: string,
  status: number,
  data: unknown,
): string {
  const safePath = redactGithubSecrets(path);
  const message = githubResponseMessage(data);
  return `${method} ${safePath} → ${status}${message ? `: ${message}` : ""}`;
}

function isEmptyGithubRepositoryMessage(message: string): boolean {
  return /git repository is empty/i.test(message);
}

function logGithubFailure(
  kind: GithubApiKind | undefined,
  method: string,
  path: string,
  status: number,
  data: unknown,
) {
  const detail = formatGithubBackupDiagnostic(method, path, status, data);
  if (kind === "repo") {
    console.error("GitHub backup repository inaccessible:", detail);
  } else if (kind === "write") {
    console.error("GitHub backup write failed:", detail);
  } else if (kind === "ref") {
    console.error("GitHub backup ref lookup failed:", detail);
  } else if (kind === "file") {
    console.error("GitHub backup file lookup failed:", detail);
  } else {
    console.error("GitHub backup API failed:", detail);
  }
}

async function githubApi(
  config: GithubEnvConfig,
  path: string,
  init?: RequestInit,
  options?: { kind?: GithubApiKind; allow?: number[] },
): Promise<GithubApiResult> {
  const method = (init?.method || "GET").toUpperCase();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "oyon-github-backup",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text().catch(() => "");
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = null;
    }
  }
  const allowed = options?.allow?.includes(response.status) ?? false;
  if (!response.ok && !allowed) {
    logGithubFailure(options?.kind, method, path, response.status, data);
  }
  return { ok: response.ok, status: response.status, data };
}

function encodeGithubContentPath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function bootstrapEmptyGithubRepo(config: GithubEnvConfig): Promise<void> {
  const encoded = encodeGithubContentPath(GITHUB_BOOTSTRAP_PATH);
  const result = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${encoded}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: "OYON GitHub backup initialize",
        content: Buffer.from("\n", "utf8").toString("base64"),
        branch: config.branch,
      }),
    },
    { kind: "write" },
  );
  if (!result.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
}

async function readBranchHead(
  config: GithubEnvConfig,
): Promise<{ parentSha: string; baseTree: string } | { missing: true; empty: boolean }> {
  const ref = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    undefined,
    { kind: "ref", allow: [404] },
  );

  if (ref.status === 404) {
    return { missing: true, empty: true };
  }

  if (ref.status === 409) {
    if (isEmptyGithubRepositoryMessage(githubResponseMessage(ref.data))) {
      return { missing: true, empty: true };
    }
    throw new Error("GITHUB_BACKUP_API_FAILED");
  }

  if (!ref.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
  const parentSha = (ref.data as { object?: { sha?: string } }).object?.sha;
  if (!parentSha) throw new Error("GITHUB_BACKUP_API_FAILED");

  const commit = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/git/commits/${parentSha}`,
    undefined,
    { kind: "write" },
  );
  if (!commit.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
  const baseTree = (commit.data as { tree?: { sha?: string } }).tree?.sha;
  if (!baseTree) throw new Error("GITHUB_BACKUP_API_FAILED");
  return { parentSha, baseTree };
}

async function resolveExistingBranchHead(
  config: GithubEnvConfig,
): Promise<{ parentSha: string; baseTree: string }> {
  const first = await readBranchHead(config);
  if (!("missing" in first)) return first;

  await bootstrapEmptyGithubRepo(config);
  const after = await readBranchHead(config);
  if ("missing" in after) throw new Error("GITHUB_BACKUP_API_FAILED");
  return after;
}

async function commitOntoExistingBranch(
  config: GithubEnvConfig,
  files: GithubCommitFile[],
  message: string,
  head: { parentSha: string; baseTree: string },
): Promise<string> {
  const treeItems: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }> = [];

  for (const file of files) {
    if (file.bytes.byteLength > GITHUB_MAX_FILE_BYTES) {
      throw new Error("GITHUB_BACKUP_FILE_TOO_LARGE");
    }
    const blob = await githubApi(
      config,
      `/repos/${config.owner}/${config.repo}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(file.bytes).toString("base64"),
          encoding: "base64",
        }),
      },
      { kind: "write" },
    );
    if (!blob.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
    const sha = (blob.data as { sha?: string }).sha;
    if (!sha) throw new Error("GITHUB_BACKUP_API_FAILED");
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha,
    });
  }

  const tree = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({
        tree: treeItems,
        base_tree: head.baseTree,
      }),
    },
    { kind: "write" },
  );
  if (!tree.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
  const treeSha = (tree.data as { sha?: string }).sha;
  if (!treeSha) throw new Error("GITHUB_BACKUP_API_FAILED");

  const commit = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: [head.parentSha],
      }),
    },
    { kind: "write" },
  );
  if (!commit.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
  const commitSha = (commit.data as { sha?: string }).sha;
  if (!commitSha) throw new Error("GITHUB_BACKUP_API_FAILED");

  const updated = await githubApi(
    config,
    `/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: commitSha }),
    },
    { kind: "write" },
  );
  if (!updated.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
  return commitSha;
}

export function createGithubRepoClient(): GithubRepoClient {
  return {
    async probeRepository() {
      const config = githubEnvConfig();
      const result = await githubApi(
        config,
        `/repos/${config.owner}/${config.repo}`,
        undefined,
        { kind: "repo" },
      );
      if (!result.ok) {
        throw new Error("GITHUB_BACKUP_REPO_INACCESSIBLE");
      }
    },

    async readJsonFile(path: string) {
      const config = githubEnvConfig();
      const encoded = encodeGithubContentPath(path);
      const result = await githubApi(
        config,
        `/repos/${config.owner}/${config.repo}/contents/${encoded}?ref=${encodeURIComponent(config.branch)}`,
        undefined,
        { kind: "file", allow: [404] },
      );
      if (result.status === 404) return null;
      if (!result.ok) throw new Error("GITHUB_BACKUP_API_FAILED");
      const body = result.data as { encoding?: string; content?: string } | null;
      if (!body?.content) return null;
      const raw =
        body.encoding === "base64"
          ? Buffer.from(body.content.replace(/\n/g, ""), "base64").toString("utf8")
          : body.content;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    },

    async commitFiles(files, message) {
      const config = githubEnvConfig();
      const head = await resolveExistingBranchHead(config);
      return commitOntoExistingBranch(config, files, message, head);
    },
  };
}

async function defaultReadLive() {
  const { readLiveStoreRow } = await import("@/lib/backup");
  return readLiveStoreRow();
}

const defaultDeps: GithubBackupDependencies = {
  readLive: defaultReadLive,
  listLiveMedia: listLiveMediaDefault,
  downloadProtected: downloadProtectedDefault,
  downloadLive: downloadLiveDefault,
  github: createGithubRepoClient(),
};

function utf8Bytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "utf8"));
}

export function toGithubBackupClientResult(
  info: GithubBackupInfo,
): GithubBackupClientResult {
  return {
    ok: info.failed === 0 && info.tooLarge.length === 0,
    complete: info.complete,
    timedOut: info.timedOut,
    remainingMedia: info.remainingMedia,
    purpose: info.purpose,
    createdAt: info.createdAt,
    appDataSha256: info.appDataSha256,
    githubCommitSha: info.githubCommitSha,
    liveMediaCount: info.liveMediaCount,
    currentLivePresentOnGithub: info.currentLivePresentOnGithub,
    githubProtectedCount: info.githubProtectedCount,
    copied: info.copied,
    skipped: info.skipped,
    failed: info.failed,
    tooLarge: info.tooLarge.length,
  };
}

export async function runGithubBackupAll(
  deps: GithubBackupDependencies = defaultDeps,
): Promise<GithubBackupInfo> {
  const vercelEnv =
    deps.vercelEnv !== undefined ? deps.vercelEnv : process.env.VERCEL_ENV;
  if (!isGithubBackupAllowed(vercelEnv)) {
    throw new Error("GITHUB_BACKUP_PRODUCTION_ONLY");
  }
  if (githubBackupInFlight) {
    throw new Error("GITHUB_BACKUP_IN_PROGRESS");
  }

  githubBackupInFlight = true;
  try {
    const now = deps.now ?? Date.now;
    const startedAt = now();
    const budget = deps.timeBudgetMs ?? GITHUB_TIME_BUDGET_MS;
    const deadlineMs = startedAt + budget;
    const createdAt = new Date(startedAt).toISOString();
    const purpose: GithubBackupPurpose = "admin-all";

    await deps.github.probeRepository();

    const live = await deps.readLive();
    if (!live.payload || typeof live.payload !== "object") {
      throw new Error("GITHUB_BACKUP_INVALID_STORE");
    }
    if (!Array.isArray(live.payload.products)) {
      throw new Error("GITHUB_BACKUP_INVALID_STORE");
    }

    const liveMedia = await deps.listLiveMedia();
    const index = parseIndex(await deps.github.readJsonFile(GITHUB_INDEX_PATH));

    let copied = 0;
    let skipped = 0;
    let failed = 0;
    let remaining = 0;
    let timedOut = false;
    const tooLarge: string[] = [];
    const pending: GithubCommitFile[] = [];

    for (const object of liveMedia) {
      if (indexMatches(object, index)) {
        skipped += 1;
        continue;
      }

      if (now() >= deadlineMs) {
        timedOut = true;
        remaining += 1;
        continue;
      }

      const declaredSize = object.size || 0;
      if (declaredSize > GITHUB_MAX_FILE_BYTES) {
        tooLarge.push(object.path);
        remaining += 1;
        continue;
      }

      try {
        const protectedCopy = await deps.downloadProtected(object.path);
        const file = protectedCopy ?? (await deps.downloadLive(object.path));
        if (file.bytes.byteLength > GITHUB_MAX_FILE_BYTES) {
          tooLarge.push(object.path);
          remaining += 1;
          continue;
        }
        pending.push({
          path: githubMediaPath(object.path),
          bytes: file.bytes,
        });
        index.objects[object.path] = {
          size: object.size || file.bytes.byteLength,
          updatedAt: object.updatedAt,
          backedUpAt: createdAt,
        };
        copied += 1;
      } catch (error) {
        failed += 1;
        remaining += 1;
        const message = error instanceof Error ? error.message : "";
        if (
          message === "GITHUB_BACKUP_LIVE_MEDIA_MISSING" ||
          message.startsWith("GITHUB_BACKUP_MEDIA_DOWNLOAD_FAILED:")
        ) {
          console.error("GitHub backup media source missing");
        } else {
          console.error("GitHub backup media copy failed");
        }
      }
    }

    const currentLivePresentOnGithub = liveMedia.filter((object) =>
      indexMatches(object, index),
    ).length;
    const complete =
      !timedOut &&
      failed === 0 &&
      tooLarge.length === 0 &&
      currentLivePresentOnGithub === liveMedia.length;

    const appDataSha256 = complete ? hashAppData(live.payload) : null;

    pending.push({
      path: GITHUB_INDEX_PATH,
      bytes: utf8Bytes(`${JSON.stringify(index, null, 2)}\n`),
    });

    if (complete) {
      pending.push({
        path: GITHUB_DATABASE_PATH,
        bytes: utf8Bytes(`${JSON.stringify(live.payload, null, 2)}\n`),
      });
    }

    const info: GithubBackupInfo = {
      complete,
      createdAt,
      purpose,
      appDataSha256,
      store: {
        table: STORE_TABLE,
        id: STORE_ID,
        updatedAt: live.updatedAt,
        payloadBytes: live.payloadBytes,
      },
      liveMediaCount: liveMedia.length,
      currentLivePresentOnGithub,
      githubProtectedCount: Object.keys(index.objects).length,
      copied,
      skipped,
      failed,
      tooLarge,
      githubCommitSha: null,
      timedOut,
      remainingMedia: remaining,
    };

    pending.push({
      path: GITHUB_INFO_PATH,
      bytes: utf8Bytes(`${JSON.stringify(info, null, 2)}\n`),
    });

    const stamp = createdAt.replace(/[:.]/g, "-");
    const message = complete
      ? `OYON GitHub backup ${stamp} complete`
      : `OYON GitHub backup ${stamp} incomplete`;
    const commitSha = await deps.github.commitFiles(pending, message);
    info.githubCommitSha = commitSha;
    try {
      info.githubCommitSha = await deps.github.commitFiles(
        [
          {
            path: GITHUB_INFO_PATH,
            bytes: utf8Bytes(`${JSON.stringify(info, null, 2)}\n`),
          },
        ],
        `${message} (receipt)`,
      );
    } catch (error) {
      console.error("GitHub backup receipt commit skipped");
      void error;
    }
    return info;
  } finally {
    githubBackupInFlight = false;
  }
}

export function resetGithubBackupInFlightForTests() {
  githubBackupInFlight = false;
}
