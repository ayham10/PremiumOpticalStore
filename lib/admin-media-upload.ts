import type { MediaItem } from "@/lib/types";
import {
  fileFingerprint,
  validateImageFile,
  type FileFingerprintInput,
} from "@/lib/media-upload";

type UploadResult = {
  url: string;
  media?: MediaItem | null;
};

const recentUploads = new Map<string, UploadResult>();

export function rememberUpload(file: FileFingerprintInput, result: UploadResult) {
  recentUploads.set(fileFingerprint(file), result);
}

export function rememberedUpload(file: FileFingerprintInput): UploadResult | undefined {
  return recentUploads.get(fileFingerprint(file));
}

export async function uploadImageFromPc(
  file: File,
  options: {
    folder: MediaItem["folder"];
    alt?: string;
    onProgress?: (pct: number) => void;
  },
): Promise<UploadResult> {
  const invalid = validateImageFile(file);
  if (invalid === "type") {
    throw new Error("UPLOAD_TYPE");
  }
  if (invalid === "size") {
    throw new Error("UPLOAD_SIZE");
  }
  if (invalid === "empty") {
    throw new Error("UPLOAD_EMPTY");
  }

  const cached = rememberedUpload(file);
  if (cached?.url) return cached;

  const body = new FormData();
  body.append("file", file);
  body.append("folder", options.folder);
  body.append("alt", options.alt || file.name.replace(/\.[^.]+$/, ""));
  body.append("register", "1");

  const result = await new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/storage/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as {
          url?: string;
          media?: MediaItem;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          resolve({ url: data.url, media: data.media });
        } else {
          reject(new Error(data.error || "UPLOAD_FAILED"));
        }
      } catch {
        reject(new Error("UPLOAD_FAILED"));
      }
    };
    xhr.onerror = () => reject(new Error("UPLOAD_FAILED"));
    xhr.send(body);
  });

  rememberUpload(file, result);
  return result;
}
