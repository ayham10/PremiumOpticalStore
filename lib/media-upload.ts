export const MEDIA_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MEDIA_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type MediaUploadErrorCode = "type" | "size" | "empty";

export type FileFingerprintInput = {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
};

export function fileFingerprint(file: FileFingerprintInput): string {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type || ""}`;
}

export function validateImageFile(file: {
  name: string;
  size: number;
  type: string;
}): MediaUploadErrorCode | null {
  const mime = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const okMime = MEDIA_IMAGE_MIMES.has(mime);
  const okExt = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
  if (!okMime && !okExt) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > MEDIA_UPLOAD_MAX_BYTES) return "size";
  return null;
}

export function galleryWithoutDuplicate<T extends { url?: string }>(
  items: T[],
  next: T,
  max: number,
): T[] {
  const url = typeof next.url === "string" ? next.url.trim() : "";
  if (!url) return items;
  if (items.some((item) => item.url === url)) return items;
  if (items.length >= max) return items;
  return [...items, next];
}
