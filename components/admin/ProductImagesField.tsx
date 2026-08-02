"use client";

import { useCallback, useRef, useState } from "react";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Upload,
} from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
};

async function uploadFile(file: File, onProgress: (pct: number) => void): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Use JPG, PNG, or WebP only");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 10 MB or smaller");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("folder", "products");
  body.append("alt", file.name.replace(/\.[^.]+$/, ""));

  // XHR for upload progress
  const url = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/storage/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          resolve(data.url);
        } else {
          reject(new Error(data.error || "Upload failed"));
        }
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(body);
  });

  return url;
}

export default function ProductImagesField({ images, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const main = images[0] || "";
  const gallery = images.slice(1, 1 + MAX_GALLERY);
  const canAddMore = images.length < 1 + MAX_GALLERY;

  const addUrls = useCallback(
    (urls: string[]) => {
      onChange([...images, ...urls].slice(0, 1 + MAX_GALLERY));
    },
    [images, onChange],
  );

  async function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) {
      setError("Drop image files only (JPG, PNG, WebP)");
      return;
    }
    if (!canAddMore) {
      setError("Maximum 1 main + 5 gallery images");
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);
    const room = 1 + MAX_GALLERY - images.length;
    const batch = files.slice(0, room);
    const uploaded: string[] = [];

    try {
      for (let i = 0; i < batch.length; i++) {
        const url = await uploadFile(batch[i], (pct) => {
          const overall = Math.round(((i + pct / 100) / batch.length) * 100);
          setProgress(overall);
        });
        uploaded.push(url);
      }
      addUrls(uploaded);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function makeMain(index: number) {
    if (index <= 0) return;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    onChange(next);
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOverItem(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const next = [...images];
    const [item] = next.splice(dragIndex, 1);
    next.splice(index, 0, item);
    setDragIndex(index);
    onChange(next);
  }

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <p className="label">Product images</p>
        <p className="text-sm text-[var(--slate)]">
          Upload a main image and up to 5 gallery photos. No URLs needed.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div
        className={`rounded-2xl border border-dashed p-5 transition ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent-wash)]"
            : "border-[var(--line-strong)] bg-[var(--admin-elevated,#181F26)]"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[rgba(212,175,55,0.12)] text-[var(--accent)]">
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} />}
          </span>
          <div>
            <p className="font-semibold text-[var(--ink)]">
              {uploading ? `Uploading… ${progress}%` : "Drag & drop images here"}
            </p>
            <p className="mt-1 text-sm text-[var(--slate)]">
              JPG, PNG, WebP · max 10 MB each
            </p>
          </div>
          <button
            type="button"
            className="btn btn-accent !min-h-11"
            disabled={uploading || !canAddMore}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus size={16} />
            Upload image
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>
        {uploading ? (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : null}
      </div>

      {main ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--slate)]">
            Main image
          </p>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--admin-card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main} alt="Main product" className="h-48 w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-bold text-[#0B0F14]">
                <Star size={12} /> Main
              </span>
              <button
                type="button"
                className="btn btn-ghost !min-h-9 !px-3 !text-xs text-white"
                onClick={() => removeAt(0)}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gallery.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--slate)]">
            Gallery · drag to reorder
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((url, gi) => {
              const index = gi + 1;
              return (
                <div
                  key={`${url}-${index}`}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOverItem(e, index)}
                  onDragEnd={() => setDragIndex(null)}
                  className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--admin-card)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                    <span className="grid h-8 w-8 cursor-grab place-items-center rounded-lg bg-black/50 text-white">
                      <GripVertical size={14} />
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Set as main"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-black/50 text-[var(--accent)]"
                        onClick={() => makeMain(index)}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-lg bg-black/50 text-[var(--danger)]"
                        onClick={() => removeAt(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
