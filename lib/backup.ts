import {
  type BackupHealthStatus,
  type BackupHistoryItem,
  type BackupStatusSummary,
} from "@/lib/backup-status";
import { supabaseConfig } from "@/lib/db/store";
import {
  getStoragePathFromUrl,
  MEDIA_BUCKET,
  supabaseServerConfig,
} from "@/lib/storage";
import type { AppData } from "@/lib/types";

export const BACKUP_BUCKET =
  process.env.SUPABASE_BACKUP_BUCKET?.trim() || "oyon-backups";
export const BACKUP_RETENTION_DAYS = 30;
export const BACKUP_SNAPSHOT_VERSION = 1 as const;

export const RESTORABLE_SECTIONS = [
  "products",
  "appointments",
  "customers",
  "staff",
  "suppliers",
  "promotions",
  "media",
  "reviews",
  "contactMessages",
  "smsLogs",
  "activityLogs",
  "holidays",
  "availability",
  "eyeExamAvailability",
  "eyeExamAppointments",
  "bookingServices",
  "lensInventory",
  "settings",
] as const;

export type RestorableSection = (typeof RESTORABLE_SECTIONS)[number];
export type BackupPurpose = "daily" | "pre-restore";

export type SectionSummary = {
  type: "array" | "object";
  count?: number;
  keys?: string[];
};

export type OyonStoreSnapshot = {
  version: typeof BACKUP_SNAPSHOT_VERSION;
  kind: "oyon-store-snapshot";
  purpose: BackupPurpose;
  createdAt: string;
  source: {
    table: string;
    id: string;
    updatedAt: string | null;
    payloadBytes: number;
  };
  /** Complete AppData. Future selective restore reads `appData[section]`. */
  appData: AppData;
  sections: Record<RestorableSection, SectionSummary>;
  media: {
    liveObjectCount: number;
    liveBytes: number;
    referencedPaths: string[];
  };
};

export type BackupRunResult = {
  ok: boolean;
  complete: boolean;
  timedOut: boolean;
  remainingMedia: number;
  purpose: BackupPurpose;
  snapshotPath: string | null;
  createdAt: string;
  store: {
    table: string;
    id: string;
    payloadBytes: number;
    updatedAt: string | null;
  };
  media: {
    liveObjectCount: number;
    liveBytes: number;
    copied: number;
    alreadyPresent: number;
    skippedUnchanged: number;
    failed: number;
  };
  prunedDailySnapshots: string[];
  prunedMediaObjects: number;
  estimatedBackupBytes: number;
  sizes: {
    luminaStorePayloadBytes: number;
    luminaMediaBytes: number;
    estimatedBackupStorageBytes: number;
  };
};

type StorageObject = {
  path: string;
  size: number;
  updatedAt: string | null;
};

type MediaIndex = {
  version: 1;
  objects: Record<
    string,
    { size: number; updatedAt: string | null; backedUpAt: string }
  >;
};

const STORE_TABLE = process.env.SUPABASE_STORE_TABLE || "lumina_store";
const STORE_ID = process.env.SUPABASE_STORE_ID || "default";
const DAILY_PREFIX = "store/daily/";
const PRE_RESTORE_PREFIX = "store/pre-restore/";
const MEDIA_OBJECT_PREFIX = "media/objects/";
const MEDIA_INDEX_PATH = "media/index.json";
/** Stop starting new copies before Vercel kills the function (maxDuration 60s). */
const BACKUP_TIME_BUDGET_MS = 45_000;

function requireConfig() {
  const config = supabaseServerConfig() ?? supabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured; cannot run backups");
  }
  return config;
}

function storageHeaders(
  config: NonNullable<ReturnType<typeof supabaseServerConfig>>,
  extra?: Record<string, string>,
) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    ...extra,
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

function jerusalemDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isoStamp(now = new Date()): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

function summarizeSections(data: AppData): Record<RestorableSection, SectionSummary> {
  const summary = {} as Record<RestorableSection, SectionSummary>;
  for (const key of RESTORABLE_SECTIONS) {
    const value = data[key];
    if (Array.isArray(value)) {
      summary[key] = { type: "array", count: value.length };
    } else if (value && typeof value === "object") {
      summary[key] = { type: "object", keys: Object.keys(value) };
    } else {
      summary[key] = { type: "object" };
    }
  }
  return summary;
}

function collectUrlStrings(value: unknown, into: string[]) {
  if (typeof value === "string") {
    if (value.includes("/storage/v1/object/") || value.startsWith("http")) {
      into.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrlStrings(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectUrlStrings(item, into);
  }
}

function referencedMediaPaths(data: AppData): string[] {
  const urls: string[] = [];
  collectUrlStrings(data, urls);
  const paths = new Set<string>();
  for (const url of urls) {
    const path = getStoragePathFromUrl(url);
    if (path) paths.add(path);
  }
  return [...paths].sort();
}

async function storageJson<T>(
  config: NonNullable<ReturnType<typeof supabaseServerConfig>>,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...storageHeaders(config, {
        "Content-Type": "application/json",
      }),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text().catch(() => "");
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null;
    }
  }
  return { ok: response.ok, status: response.status, data, text };
}

/**
 * Ensure the backup bucket exists and is private.
 * Never creates or alters `lumina-media` or `lumina_store`.
 */
export async function ensureBackupBucket(): Promise<void> {
  const config = requireConfig();
  const existing = await fetch(
    `${config.url}/storage/v1/bucket/${BACKUP_BUCKET}`,
    { headers: storageHeaders(config), cache: "no-store" },
  );

  if (existing.ok) {
    const body = (await existing.json().catch(() => null)) as {
      public?: boolean;
    } | null;
    if (body?.public) {
      const update = await fetch(
        `${config.url}/storage/v1/bucket/${BACKUP_BUCKET}`,
        {
          method: "PUT",
          headers: storageHeaders(config, { "Content-Type": "application/json" }),
          body: JSON.stringify({ public: false }),
        },
      );
      if (!update.ok) {
        const detail = await update.text().catch(() => "");
        throw new Error(
          `Failed to mark ${BACKUP_BUCKET} private (${update.status})${
            detail ? `: ${detail}` : ""
          }`,
        );
      }
    }
    return;
  }

  const create = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: BACKUP_BUCKET,
      name: BACKUP_BUCKET,
      public: false,
      fileSizeLimit: 52428800,
    }),
  });

  if (!create.ok && create.status !== 409) {
    const detail = await create.text().catch(() => "");
    throw new Error(
      `Failed to create private backup bucket (${create.status})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }
}

async function listPrefix(
  bucket: string,
  prefix: string,
): Promise<StorageObject[]> {
  const config = requireConfig();
  const out: StorageObject[] = [];
  const queue = [prefix.replace(/^\/+|\/+$/g, "")];

  while (queue.length) {
    const current = queue.shift() ?? "";
    let offset = 0;
    for (;;) {
      const listed = await storageJson<
        Array<{
          name: string;
          id: string | null;
          updated_at?: string;
          metadata?: { size?: number };
        }>
      >(config, `/storage/v1/object/list/${bucket}`, {
        method: "POST",
        body: JSON.stringify({
          prefix: current,
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      });
      if (!listed.ok) {
        throw new Error(
          `Storage list failed for ${bucket}/${current} (${listed.status}) ${listed.text}`,
        );
      }
      const page = listed.data ?? [];
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

async function downloadObject(
  bucket: string,
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${bucket}/${path}`,
    { headers: storageHeaders(config), cache: "no-store" },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Download failed ${bucket}/${path} (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  return { bytes, contentType };
}

async function uploadObject(
  bucket: string,
  path: string,
  body: Uint8Array | string,
  contentType: string,
) {
  const config = requireConfig();
  const payload = typeof body === "string" ? Buffer.from(body) : Buffer.from(body);
  const response = await fetch(
    `${config.url}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(config, {
          "Content-Type": contentType,
          "x-upsert": "true",
        }),
      },
      body: payload,
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Upload failed ${bucket}/${path} (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }
}

async function deleteObjects(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const config = requireConfig();
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const response = await fetch(`${config.url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: storageHeaders(config, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: chunk }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Backup delete failed (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }
  }
}

/**
 * Read-only. Does not seed, write, or normalize production `lumina_store`.
 */
export async function readLiveStoreRow(): Promise<{
  payload: AppData;
  updatedAt: string | null;
  payloadBytes: number;
}> {
  const config = requireConfig();
  const url = `${config.url}/rest/v1/${STORE_TABLE}?id=eq.${encodeURIComponent(
    STORE_ID,
  )}&select=payload,updated_at`;
  const response = await fetch(url, {
    headers: storageHeaders(config),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to read ${STORE_TABLE}/${STORE_ID} (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }
  const rows = (await response.json()) as Array<{
    payload?: AppData;
    updated_at?: string;
  }>;
  const row = rows[0];
  if (!row?.payload || typeof row.payload !== "object") {
    throw new Error(
      `${STORE_TABLE}/${STORE_ID} is missing a payload; backup aborted without writing live data`,
    );
  }
  const payloadBytes = Buffer.byteLength(JSON.stringify(row.payload), "utf8");
  return {
    payload: row.payload,
    updatedAt: row.updated_at ?? row.payload.updatedAt ?? null,
    payloadBytes,
  };
}

function buildSnapshot(
  purpose: BackupPurpose,
  live: { payload: AppData; updatedAt: string | null; payloadBytes: number },
  mediaObjects: StorageObject[],
): OyonStoreSnapshot {
  const referenced = new Set(referencedMediaPaths(live.payload));
  for (const object of mediaObjects) referenced.add(object.path);
  return {
    version: BACKUP_SNAPSHOT_VERSION,
    kind: "oyon-store-snapshot",
    purpose,
    createdAt: new Date().toISOString(),
    source: {
      table: STORE_TABLE,
      id: STORE_ID,
      updatedAt: live.updatedAt,
      payloadBytes: live.payloadBytes,
    },
    appData: live.payload,
    sections: summarizeSections(live.payload),
    media: {
      liveObjectCount: mediaObjects.length,
      liveBytes: mediaObjects.reduce((sum, item) => sum + item.size, 0),
      referencedPaths: [...referenced].sort(),
    },
  };
}

async function readMediaIndex(): Promise<MediaIndex> {
  try {
    const { bytes } = await downloadObject(BACKUP_BUCKET, MEDIA_INDEX_PATH);
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as MediaIndex;
    if (parsed?.version === 1 && parsed.objects && typeof parsed.objects === "object") {
      return parsed;
    }
  } catch {
    /* first run or missing index */
  }
  return { version: 1, objects: {} };
}

function mediaIndexMatches(
  object: StorageObject,
  index: MediaIndex,
): boolean {
  const known = index.objects[object.path];
  return Boolean(
    known &&
      known.size === object.size &&
      (known.updatedAt || "") === (object.updatedAt || ""),
  );
}

async function writeMediaIndex(index: MediaIndex) {
  await uploadObject(
    BACKUP_BUCKET,
    MEDIA_INDEX_PATH,
    JSON.stringify(index),
    "application/json",
  );
}

async function copyMediaIncrementally(
  liveObjects: StorageObject[],
  deadlineMs: number,
) {
  const index = await readMediaIndex();
  const now = new Date().toISOString();
  let copied = 0;
  let alreadyPresent = 0;
  let skippedUnchanged = 0;
  let failed = 0;
  let remaining = 0;
  let timedOut = false;

  for (const object of liveObjects) {
    const existed = Boolean(index.objects[object.path]);
    if (mediaIndexMatches(object, index)) {
      skippedUnchanged += 1;
      continue;
    }

    if (Date.now() >= deadlineMs) {
      timedOut = true;
      remaining += 1;
      continue;
    }

    try {
      const file = await downloadObject(MEDIA_BUCKET, object.path);
      await uploadObject(
        BACKUP_BUCKET,
        joinPath(MEDIA_OBJECT_PREFIX, object.path),
        file.bytes,
        file.contentType,
      );
      index.objects[object.path] = {
        size: object.size || file.bytes.byteLength,
        updatedAt: object.updatedAt,
        backedUpAt: now,
      };
      await writeMediaIndex(index);
      if (existed) alreadyPresent += 1;
      else copied += 1;
    } catch (error) {
      failed += 1;
      remaining += 1;
      console.error(`Backup media copy failed for ${object.path}`, error);
    }
  }

  const complete =
    !timedOut &&
    failed === 0 &&
    liveObjects.every((object) => mediaIndexMatches(object, index));

  return {
    index,
    copied,
    alreadyPresent,
    skippedUnchanged,
    failed,
    remaining,
    timedOut,
    complete,
  };
}

function dailySnapshotDate(path: string): string | null {
  const name = path.slice(DAILY_PREFIX.length);
  const match = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
  return match?.[1] ?? null;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function pruneDailySnapshots(keepDays: number): Promise<string[]> {
  const objects = await listPrefix(BACKUP_BUCKET, DAILY_PREFIX.replace(/\/$/, ""));
  const cutoffStamp = shiftIsoDate(jerusalemDate(), -keepDays);
  const stale = objects.filter((object) => {
    const date = dailySnapshotDate(object.path);
    return date != null && date < cutoffStamp;
  });
  await deleteObjects(
    BACKUP_BUCKET,
    stale.map((object) => object.path),
  );
  return stale.map((object) => object.path);
}

async function pruneUnreferencedMedia(index: MediaIndex): Promise<number> {
  const daily = await listPrefix(BACKUP_BUCKET, DAILY_PREFIX.replace(/\/$/, ""));
  const pre = await listPrefix(BACKUP_BUCKET, PRE_RESTORE_PREFIX.replace(/\/$/, ""));
  const keep = new Set<string>();

  for (const snapshot of [...daily, ...pre]) {
    try {
      const { bytes } = await downloadObject(BACKUP_BUCKET, snapshot.path);
      const parsed = JSON.parse(
        Buffer.from(bytes).toString("utf8"),
      ) as OyonStoreSnapshot;
      for (const path of parsed.media?.referencedPaths ?? []) keep.add(path);
    } catch (error) {
      console.error(`Backup GC skipped unreadable snapshot ${snapshot.path}`, error);
      return 0;
    }
  }

  const stale = Object.keys(index.objects).filter((path) => !keep.has(path));
  await deleteObjects(
    BACKUP_BUCKET,
    stale.map((path) => joinPath(MEDIA_OBJECT_PREFIX, path)),
  );
  for (const path of stale) delete index.objects[path];
  await uploadObject(
    BACKUP_BUCKET,
    MEDIA_INDEX_PATH,
    JSON.stringify(index),
    "application/json",
  );
  return stale.length;
}

async function estimateBackupBytes(): Promise<number> {
  const objects = [
    ...(await listPrefix(BACKUP_BUCKET, "store")),
    ...(await listPrefix(BACKUP_BUCKET, "media")),
  ];
  return objects.reduce((sum, item) => sum + item.size, 0);
}

async function writeSnapshot(
  purpose: BackupPurpose,
  pruneDaily: boolean,
): Promise<BackupRunResult> {
  const startedAt = Date.now();
  const deadlineMs = startedAt + BACKUP_TIME_BUDGET_MS;
  await ensureBackupBucket();

  const live = await readLiveStoreRow();
  const liveMedia = await listPrefix(MEDIA_BUCKET, "");
  const media = await copyMediaIncrementally(liveMedia, deadlineMs);

  const snapshot = buildSnapshot(purpose, live, liveMedia);
  const intendedPath =
    purpose === "pre-restore"
      ? `${PRE_RESTORE_PREFIX}${isoStamp()}.json`
      : `${DAILY_PREFIX}${jerusalemDate()}.json`;

  let snapshotPath: string | null = null;
  let prunedDailySnapshots: string[] = [];
  let prunedMediaObjects = 0;

  if (media.complete) {
    await uploadObject(
      BACKUP_BUCKET,
      intendedPath,
      JSON.stringify(snapshot),
      "application/json",
    );
    snapshotPath = intendedPath;
    if (pruneDaily) {
      prunedDailySnapshots = await pruneDailySnapshots(BACKUP_RETENTION_DAYS);
      prunedMediaObjects = await pruneUnreferencedMedia(media.index);
    }
  }

  const estimatedBackupBytes = await estimateBackupBytes();
  const liveBytes = liveMedia.reduce((sum, item) => sum + item.size, 0);

  return {
    ok: media.complete,
    complete: media.complete,
    timedOut: media.timedOut,
    remainingMedia: media.remaining,
    purpose,
    snapshotPath,
    createdAt: snapshot.createdAt,
    store: {
      table: STORE_TABLE,
      id: STORE_ID,
      payloadBytes: live.payloadBytes,
      updatedAt: live.updatedAt,
    },
    media: {
      liveObjectCount: liveMedia.length,
      liveBytes,
      copied: media.copied,
      alreadyPresent: media.alreadyPresent,
      skippedUnchanged: media.skippedUnchanged,
      failed: media.failed,
    },
    prunedDailySnapshots,
    prunedMediaObjects,
    estimatedBackupBytes,
    sizes: {
      luminaStorePayloadBytes: live.payloadBytes,
      luminaMediaBytes: liveBytes,
      estimatedBackupStorageBytes: estimatedBackupBytes,
    },
  };
}

/** Daily complete snapshot. Read-only against production business data. */
export async function runDailyBackup(): Promise<BackupRunResult> {
  return writeSnapshot("daily", true);
}

/**
 * Future restore MUST call this first. Writes the current production
 * AppData into `store/pre-restore/` without changing live data.
 */
export async function createPreRestoreSnapshot(): Promise<BackupRunResult> {
  return writeSnapshot("pre-restore", false);
}

function sectionCount(
  sections: Record<string, SectionSummary> | undefined,
  key: RestorableSection,
): number | null {
  const summary = sections?.[key];
  return summary?.type === "array" && typeof summary.count === "number"
    ? summary.count
    : null;
}

function isCompletedDailySnapshot(
  value: unknown,
): value is OyonStoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<OyonStoreSnapshot>;
  return (
    snapshot.kind === "oyon-store-snapshot" &&
    snapshot.purpose === "daily" &&
    Boolean(snapshot.createdAt) &&
    Boolean(snapshot.sections) &&
    typeof snapshot.sections === "object"
  );
}

function toHistoryItem(
  date: string,
  sizeBytes: number,
  snapshot: OyonStoreSnapshot,
): BackupHistoryItem {
  return {
    date,
    createdAt: snapshot.createdAt,
    sizeBytes,
    appointments: sectionCount(snapshot.sections, "eyeExamAppointments"),
    products: sectionCount(snapshot.sections, "products"),
    lensInventory: sectionCount(snapshot.sections, "lensInventory"),
    customers: sectionCount(snapshot.sections, "customers"),
    promotions: sectionCount(snapshot.sections, "promotions"),
    settingsIncluded: snapshot.sections.settings?.type === "object",
    mediaObjectCount:
      typeof snapshot.media?.liveObjectCount === "number"
        ? snapshot.media.liveObjectCount
        : null,
    status: "success",
  };
}

function utcMidnightLocalTime(timeZone: string, now = new Date()): string {
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utcMidnight));
}

async function readMediaStatusSafe(): Promise<BackupStatusSummary["media"]> {
  try {
    const { bytes } = await downloadObject(BACKUP_BUCKET, MEDIA_INDEX_PATH);
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as MediaIndex;
    if (parsed?.version !== 1 || !parsed.objects || typeof parsed.objects !== "object") {
      throw new Error("invalid media index");
    }
    let lastSyncedAt: string | null = null;
    for (const entry of Object.values(parsed.objects)) {
      if (entry?.backedUpAt && (!lastSyncedAt || entry.backedUpAt > lastSyncedAt)) {
        lastSyncedAt = entry.backedUpAt;
      }
    }
    return {
      protectedCount: Object.keys(parsed.objects).length,
      incremental: true,
      lastSyncedAt,
    };
  } catch {
    return {
      protectedCount: null,
      incremental: true,
      lastSyncedAt: null,
    };
  }
}

/**
 * Read-only Admin summary. Lists retained daily snapshots and returns
 * counts/metadata only — never appData, paths, signed URLs, or credentials.
 */
export async function getBackupStatusSummary(): Promise<BackupStatusSummary> {
  const objects = await listPrefix(BACKUP_BUCKET, DAILY_PREFIX.replace(/\/$/, ""));
  const daily = objects
    .map((object) => {
      const date = dailySnapshotDate(object.path);
      return date ? { object, date } : null;
    })
    .filter((item): item is { object: StorageObject; date: string } => item != null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const history: BackupHistoryItem[] = [];
  for (const item of daily) {
    try {
      const { bytes } = await downloadObject(BACKUP_BUCKET, item.object.path);
      const parsed = JSON.parse(
        Buffer.from(bytes).toString("utf8"),
      ) as unknown;
      if (!isCompletedDailySnapshot(parsed)) continue;
      history.push(
        toHistoryItem(
          item.date,
          item.object.size || bytes.byteLength,
          parsed,
        ),
      );
    } catch (error) {
      console.error(`Backup status skipped unreadable snapshot ${item.date}`, error);
    }
  }

  const latest = history[0] ?? null;
  const today = jerusalemDate();
  const yesterday = shiftIsoDate(today, -1);
  const status: BackupHealthStatus = !latest
    ? "none"
    : latest.date >= yesterday
      ? "healthy"
      : "warning";

  const media = await readMediaStatusSafe();
  if (media.protectedCount == null && latest?.mediaObjectCount != null) {
    media.protectedCount = latest.mediaObjectCount;
  }

  return {
    status,
    retentionDays: BACKUP_RETENTION_DAYS,
    automatic: {
      enabled: true,
      schedule: "daily",
      timeUtc: "00:00",
      localTimeZone: "Asia/Jerusalem",
      localTime: utcMidnightLocalTime("Asia/Jerusalem"),
    },
    latest,
    history,
    media,
  };
}
