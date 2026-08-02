"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
};

export default function SingleImageField({
  label = "Image",
  value,
  onChange,
  folder = "promotions",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    if (!ALLOWED.has(file.type)) {
      setError("Use JPG, PNG, or WebP only");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 10 MB or smaller");
      return;
    }
    setError("");
    setUploading(true);
    setProgress(0);

    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/storage/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText) as {
              url?: string;
              error?: string;
            };
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
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <p className="label">{label}</p>
      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-40 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <button
              type="button"
              className="btn btn-ghost !min-h-9 !px-3 !text-xs text-white"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus size={14} /> Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost !min-h-9 !px-3 !text-xs text-[var(--danger)]"
              onClick={() => onChange("")}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-2xl border border-dashed p-5 text-center transition ${
            dragOver
              ? "border-[var(--accent)] bg-[var(--accent-wash)]"
              : "border-[var(--line-strong)] bg-[var(--admin-elevated)]"
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
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
        >
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[rgba(212,175,55,0.12)] text-[var(--accent)]">
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Upload size={20} />
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {uploading ? `Uploading… ${progress}%` : "Drag & drop or upload"}
          </p>
          <p className="mt-1 text-xs text-[var(--slate)]">JPG, PNG, WebP · max 10 MB</p>
          <button
            type="button"
            className="btn btn-accent mt-3 !min-h-10"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            Upload image
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
