"use client";

import { useCallback, useRef, useState } from "react";
import {
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY = 5;
const ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

const GOLD = "#D4AF6A";
const FIELD_BG = "#151A21";
const BORDER = "#2A2F36";
const MUTED = "#8A929C";

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
};

async function uploadFile(file: File, onProgress: (pct: number) => void): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("استخدم JPG أو PNG أو WebP فقط");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("يجب أن تكون الصورة أصغر من 10 ميغابايت");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("folder", "products");
  body.append("alt", file.name.replace(/\.[^.]+$/, ""));

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
          reject(new Error(data.error || "فشل الرفع"));
        }
      } catch {
        reject(new Error("فشل الرفع"));
      }
    };
    xhr.onerror = () => reject(new Error("فشل الرفع"));
    xhr.send(body);
  });

  return url;
}

export default function ProductImagesField({ images, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
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
      setError("أسقط ملفات صور فقط (JPG, PNG, WebP)");
      return;
    }
    if (!canAddMore) {
      setError("الحد الأقصى صورة رئيسية + 5 صور للمعرض");
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
      setError(err instanceof Error ? err.message : "فشل الرفع");
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
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error ? (
        <p
          className="rounded-[12px] px-3 py-2 text-sm"
          style={{
            border: "1px solid rgba(224,122,122,0.35)",
            background: "rgba(224,122,122,0.12)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      {main ? (
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: FIELD_BG,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={main}
            alt=""
            className="w-full object-cover"
            style={{ height: 220 }}
          />
          <span
            className="absolute start-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold"
            style={{ background: GOLD, color: "#0B0F14" }}
          >
            <Star size={11} strokeWidth={1.6} />
            رئيسية
          </span>
          <button
            type="button"
            aria-label="حذف"
            className="absolute end-2.5 top-2.5 grid place-items-center rounded-[10px]"
            style={{
              width: 34,
              height: 34,
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${BORDER}`,
              color: "#F07178",
            }}
            onClick={() => removeAt(0)}
          >
            <Trash2 size={15} strokeWidth={1.55} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading || !canAddMore}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2"
          style={{
            height: 220,
            borderRadius: 12,
            border: `1px dashed ${BORDER}`,
            background: FIELD_BG,
            color: MUTED,
          }}
        >
          {uploading ? (
            <Loader2 size={22} className="animate-spin" color={GOLD} />
          ) : (
            <ImagePlus size={22} strokeWidth={1.55} color={GOLD} />
          )}
          <span className="text-[0.86rem] font-semibold" style={{ color: "#F3F4F5" }}>
            {uploading ? `جارٍ الرفع… ${progress}%` : "إضافة صورة رئيسية"}
          </span>
        </button>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {gallery.map((url, gi) => {
          const index = gi + 1;
          return (
            <div
              key={`${url}-${index}`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOverItem(e, index)}
              onDragEnd={() => setDragIndex(null)}
              className="relative overflow-hidden"
              style={{
                borderRadius: 12,
                border: `1px solid ${BORDER}`,
                background: FIELD_BG,
                aspectRatio: "1 / 1",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1.5">
                <span
                  className="grid place-items-center rounded-lg"
                  style={{
                    width: 28,
                    height: 28,
                    background: "rgba(0,0,0,0.5)",
                    color: "#fff",
                  }}
                >
                  <GripVertical size={13} />
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="تعيين كرئيسية"
                    className="grid place-items-center rounded-lg"
                    style={{
                      width: 28,
                      height: 28,
                      background: "rgba(0,0,0,0.5)",
                      color: GOLD,
                    }}
                    onClick={() => makeMain(index)}
                  >
                    <Star size={13} strokeWidth={1.55} />
                  </button>
                  <button
                    type="button"
                    title="حذف"
                    className="grid place-items-center rounded-lg"
                    style={{
                      width: 28,
                      height: 28,
                      background: "rgba(0,0,0,0.5)",
                      color: "#F07178",
                    }}
                    onClick={() => removeAt(index)}
                  >
                    <Trash2 size={13} strokeWidth={1.55} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {canAddMore ? (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="grid place-items-center"
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 12,
              border: `1px dashed ${BORDER}`,
              background: FIELD_BG,
              color: GOLD,
            }}
            aria-label="إضافة صورة"
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Plus size={22} strokeWidth={1.55} />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
