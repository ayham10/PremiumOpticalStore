"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, Star, Trash2 } from "lucide-react";

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
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error ? <p className="admin-pe-error">{error}</p> : null}

      {canAddMore ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="admin-pe-drop"
        >
          <span className="admin-pe-drop-icon">
            {uploading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Camera size={20} strokeWidth={1.5} />
            )}
          </span>
          <span className="admin-pe-drop-title">
            {uploading ? `جارٍ الرفع… ${progress}%` : "إضافة صورة"}
          </span>
          <span className="admin-pe-drop-hint">
            حتى 5MB · PNG / JPG · نسبة 1:1 مفضّلة
          </span>
        </button>
      ) : null}

      {images.length > 0 ? (
        <div className="admin-pe-thumbs">
          {images.map((url, index) => {
            const isMain = index === 0;
            return (
              <div
                key={`${url}-${index}`}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragOver={(e) => onDragOverItem(e, index)}
                onDragEnd={() => setDragIndex(null)}
                className={isMain ? "admin-pe-thumb is-main" : "admin-pe-thumb"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" />

                {isMain ? (
                  <>
                    <span className="admin-pe-thumb-badge">رئيسية</span>
                    <button
                      type="button"
                      aria-label="حذف"
                      className="admin-pe-thumb-del"
                      onClick={() => removeAt(0)}
                    >
                      <Trash2 size={13} strokeWidth={1.55} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label="حذف"
                      className="admin-pe-thumb-del"
                      onClick={() => removeAt(index)}
                    >
                      <Trash2 size={13} strokeWidth={1.55} />
                    </button>
                    <button
                      type="button"
                      title="تعيين كرئيسية"
                      className="admin-pe-thumb-star"
                      onClick={() => makeMain(index)}
                    >
                      <Star size={13} strokeWidth={1.55} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {images.length > 1 ? (
        <p className="admin-pe-reorder">اسحب الصور لتغيير الترتيب ←</p>
      ) : null}
    </div>
  );
}
