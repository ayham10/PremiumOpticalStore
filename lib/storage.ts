export const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || "lumina-media";

export function supabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secretKey
    ? { url: url.replace(/\/$/, ""), secretKey }
    : null;
}

function supabaseHeaders(
  config: NonNullable<ReturnType<typeof supabaseServerConfig>>
) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
  };
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

let mediaBucketEnsured = false;

export function inferContentType(filename: string, declared?: string): string {
  const normalized = (declared || "").toLowerCase().trim();
  if (normalized && normalized !== "application/octet-stream") {
    return normalized;
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || normalized || "application/octet-stream";
}

export function isAllowedUploadMime(contentType: string): boolean {
  const mime = contentType.toLowerCase();
  return ALLOWED_IMAGE_MIMES.has(mime) || ALLOWED_VIDEO_MIMES.has(mime);
}

export async function ensureMediaBucket(): Promise<void> {
  if (mediaBucketEnsured) return;

  const config = supabaseServerConfig();
  if (!config) throw new Error("Supabase is not configured");

  const bucketUrl = `${config.url}/storage/v1/bucket/${MEDIA_BUCKET}`;
  const existing = await fetch(bucketUrl, {
    headers: supabaseHeaders(config),
    cache: "no-store",
  });

  if (existing.ok) {
    mediaBucketEnsured = true;
    return;
  }

  const create = await fetch(`${config.url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: MEDIA_BUCKET,
      name: MEDIA_BUCKET,
      public: true,
    }),
  });

  if (!create.ok && create.status !== 409) {
    const detail = await create.text().catch(() => "");
    throw new Error(
      `Failed to ensure media bucket (${create.status})${
        detail ? `: ${detail}` : ""
      }`
    );
  }

  mediaBucketEnsured = true;
}

export function extensionFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] || "bin";
}

export function generateFilename(slug: string, mime: string): string {
  const safe =
    slug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").slice(0, 48) ||
    "media";
  return `${safe}-${Date.now()}.${extensionFromMime(mime)}`;
}

export function isBase64Image(value: string): boolean {
  return value.startsWith("data:image/");
}

export function isStorageUrl(value: string): boolean {
  return (
    value.includes("/storage/v1/object/") && value.includes(`/${MEDIA_BUCKET}/`)
  );
}

export function getStoragePathFromUrl(url: string): string | null {
  const match = url.match(new RegExp(`/${MEDIA_BUCKET}/(.+)$`));
  if (!match) return null;
  return decodeURIComponent(match[1].split("?")[0]);
}

export function getPublicUrl(path: string): string {
  const config = supabaseServerConfig();
  if (!config) throw new Error("Supabase is not configured");
  return `${config.url}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export async function uploadMedia(
  file: Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const config = supabaseServerConfig();
  if (!config) throw new Error("Supabase is not configured");

  await ensureMediaBucket();

  const path = filename.replace(/^\/+/, "");
  const url = `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${path}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: Buffer.from(file),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Upload failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }

  return getPublicUrl(path);
}

export async function deleteMedia(urlOrPath: string): Promise<void> {
  if (!isStorageUrl(urlOrPath)) return;
  const config = supabaseServerConfig();
  if (!config) throw new Error("Supabase is not configured");

  const objectPath = getStoragePathFromUrl(urlOrPath);
  if (!objectPath) return;

  const url = `${config.url}/storage/v1/object/${MEDIA_BUCKET}/${objectPath}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: supabaseHeaders(config),
  });

  if (!response.ok && response.status !== 404) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Delete failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }
}
