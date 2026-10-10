import { BACKUP_BUCKET } from "@/lib/backup";
import {
  getStoragePathFromUrl,
  MEDIA_BUCKET,
  supabaseServerConfig,
} from "@/lib/storage";

const MEDIA_OBJECT_PREFIX = "media/objects/";

export type RestoreMediaResult = {
  complete: boolean;
  referenced: number;
  alreadyPresent: number;
  restored: number;
  missing: number;
  failed: number;
};

export type RestoreMediaDependencies = {
  liveExists: (path: string) => Promise<boolean>;
  downloadProtected: (
    path: string,
  ) => Promise<{ bytes: Uint8Array; contentType: string } | null>;
  uploadLive: (
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<void>;
  verifyLive: (path: string, expectedBytes: number) => Promise<boolean>;
};

function storageHeaders(
  config: NonNullable<ReturnType<typeof supabaseServerConfig>>,
) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
  };
}

function requireConfig() {
  const config = supabaseServerConfig();
  if (!config) {
    throw new Error("Supabase is not configured; cannot restore media");
  }
  return config;
}

function joinPath(...parts: string[]) {
  return parts
    .map((part, index) =>
      index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, ""),
    )
    .filter(Boolean)
    .join("/");
}

const BARE_MEDIA_PREFIX = /^(products|custom-pages|media|promotions|branding)\//;

function isReferencedMediaValue(value: string): boolean {
  return (
    value.includes("/storage/v1/object/") ||
    value.startsWith("http") ||
    BARE_MEDIA_PREFIX.test(value)
  );
}

function collectUrlStrings(value: unknown, into: string[]) {
  if (typeof value === "string") {
    if (isReferencedMediaValue(value)) into.push(value);
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

export function collectReferencedMediaPaths(data: unknown): string[] {
  const urls: string[] = [];
  collectUrlStrings(data, urls);
  const paths = new Set<string>();
  for (const url of urls) {
    const path = getStoragePathFromUrl(url) || (BARE_MEDIA_PREFIX.test(url) ? url : null);
    if (path) paths.add(path);
  }
  return [...paths].sort();
}

export function publicMediaName(path: string): string {
  const name = path.split("/").filter(Boolean).pop() || "file";
  return name.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "file";
}

async function defaultLiveExists(path: string): Promise<boolean> {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${path}`,
    {
      method: "HEAD",
      headers: storageHeaders(config),
      cache: "no-store",
    },
  );
  if (response.ok) return true;
  if (response.status === 400 || response.status === 404) return false;
  const get = await fetch(`${config.url}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
    method: "GET",
    headers: storageHeaders(config),
    cache: "no-store",
  });
  return get.ok;
}

async function defaultDownloadProtected(path: string) {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${BACKUP_BUCKET}/${joinPath(MEDIA_OBJECT_PREFIX, path)}`,
    { headers: storageHeaders(config), cache: "no-store" },
  );
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`RESTORE_MEDIA_DOWNLOAD_FAILED:${response.status}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function defaultUploadLive(
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        ...storageHeaders(config),
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: Buffer.from(bytes),
    },
  );
  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error(`RESTORE_MEDIA_UPLOAD_FAILED:${response.status}`);
  }
}

async function defaultVerifyLive(path: string, expectedBytes: number) {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${path}`,
    { headers: storageHeaders(config), cache: "no-store" },
  );
  if (!response.ok) return false;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength === expectedBytes;
}

const defaultDeps: RestoreMediaDependencies = {
  liveExists: defaultLiveExists,
  downloadProtected: defaultDownloadProtected,
  uploadLive: defaultUploadLive,
  verifyLive: defaultVerifyLive,
};

export async function restoreMissingMedia(
  source: unknown,
  deps: RestoreMediaDependencies = defaultDeps,
): Promise<RestoreMediaResult> {
  const paths = collectReferencedMediaPaths(source);
  let alreadyPresent = 0;
  let restored = 0;
  let missing = 0;
  let failed = 0;

  for (const path of paths) {
    try {
      if (await deps.liveExists(path)) {
        alreadyPresent += 1;
        continue;
      }
      const file = await deps.downloadProtected(path);
      if (!file) {
        missing += 1;
        continue;
      }
      await deps.uploadLive(path, file.bytes, file.contentType);
      const verified = await deps.verifyLive(path, file.bytes.byteLength);
      if (!verified) {
        failed += 1;
        continue;
      }
      restored += 1;
    } catch (error) {
      failed += 1;
      console.error("Restore media copy failed", error);
    }
  }

  return {
    complete: missing === 0 && failed === 0,
    referenced: paths.length,
    alreadyPresent,
    restored,
    missing,
    failed,
  };
}

export function toClientMediaResult(result: RestoreMediaResult) {
  return {
    complete: result.complete,
    referenced: result.referenced,
    alreadyPresent: result.alreadyPresent,
    restored: result.restored,
    missing: result.missing,
    failed: result.failed,
  };
}
