"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import AdminMediaPicker from "@/components/admin/AdminMediaPicker";
import { uploadImageFromPc } from "@/lib/admin-media-upload";
import { MEDIA_IMAGE_ACCEPT } from "@/lib/media-upload";

const MAX_GALLERY = 5;

type Translate = (path: string, vars?: Record<string, string | number>) => string;

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
  allowLibrary?: boolean;
  t?: Translate;
};

export default function ProductImagesField({
  images,
  onChange,
  allowLibrary,
  t,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canAddMore = images.length < 1 + MAX_GALLERY;
  const typeError = t
    ? t("admin.servicePages.uploadErrorType")
    : "استخدم JPG أو PNG أو WebP فقط";
  const sizeError = t
    ? t("admin.servicePages.uploadErrorSize")
    : "يجب أن تكون الصورة أصغر من 10 ميغابايت";
  const failError = t ? t("admin.servicePages.uploadError") : "فشل الرفع";
  const maxError = t
    ? t("admin.servicePages.productImageLimit")
    : "الحد الأقصى صورة رئيسية + 5 صور للمعرض";

  const addUrls = useCallback(
    (urls: string[]) => {
      const next = [...images];
      for (const url of urls) {
        if (!url || next.includes(url)) continue;
        next.push(url);
        if (next.length >= 1 + MAX_GALLERY) break;
      }
      onChange(next);
    },
    [images, onChange],
  );

  async function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    if (!files.length) {
      setError(typeError);
      return;
    }
    if (!canAddMore) {
      setError(maxError);
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
        const result = await uploadImageFromPc(batch[i]!, {
          folder: "products",
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / batch.length) * 100);
            setProgress(overall);
          },
        });
        uploaded.push(result.url);
      }
      addUrls(uploaded);
      setProgress(100);
    } catch (err) {
      const code = err instanceof Error ? err.message : "UPLOAD_FAILED";
      if (code === "UPLOAD_TYPE") setError(typeError);
      else if (code === "UPLOAD_SIZE") setError(sizeError);
      else setError(failError);
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
        accept={MEDIA_IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error ? <p className="admin-pe-error">{error}</p> : null}

      {allowLibrary && canAddMore ? (
        <div className="csp-inline-actions" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={uploading}
            onClick={() => setPickerOpen(true)}
          >
            <ImagePlus size={16} />
            {t
              ? t("admin.servicePages.chooseExistingPhoto")
              : "اختيار صورة موجودة"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading
              ? t
                ? t("admin.servicePages.uploading", { n: progress })
                : `جارٍ الرفع… ${progress}%`
              : t
                ? t("admin.servicePages.uploadNewPhoto")
                : "رفع صورة جديدة"}
          </button>
        </div>
      ) : null}

      {canAddMore && !allowLibrary ? (
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

      {allowLibrary && uploading ? (
        <div className="csp-upload-track" aria-hidden>
          <span className="csp-upload-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {allowLibrary ? (
        <AdminMediaPicker
          open={pickerOpen}
          title={
            t
              ? t("admin.servicePages.chooseExistingPhoto")
              : "اختيار صورة موجودة"
          }
          accept="image"
          emptyLabel={
            t ? t("admin.servicePages.mediaEmpty") : "لا توجد وسائط بعد"
          }
          stacked
          onClose={() => setPickerOpen(false)}
          onPick={(media) => {
            if (media.kind === "image" && media.url) addUrls([media.url]);
            setPickerOpen(false);
          }}
        />
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
