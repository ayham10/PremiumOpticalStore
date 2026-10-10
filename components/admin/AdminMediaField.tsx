"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import AdminMediaPicker from "@/components/admin/AdminMediaPicker";
import { uploadImageFromPc } from "@/lib/admin-media-upload";
import { MEDIA_IMAGE_ACCEPT } from "@/lib/media-upload";
import type { CustomPageMediaRef, MediaItem } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function AdminMediaField({
  value,
  onChange,
  t,
  folder = "general",
  accept = "image",
  stacked,
  hidePreview,
}: {
  value?: CustomPageMediaRef;
  onChange: (media: CustomPageMediaRef) => void;
  t: Translate;
  folder?: MediaItem["folder"];
  accept?: "image" | "video" | "any";
  stacked?: boolean;
  hidePreview?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return;
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadImageFromPc(file, {
        folder,
        onProgress: setProgress,
      });
      if (!result.url) throw new Error("UPLOAD_FAILED");
      onChange({
        kind: "image",
        url: result.url,
        mediaId: result.media?.id,
      });
      setProgress(100);
    } catch (err) {
      const code = err instanceof Error ? err.message : "UPLOAD_FAILED";
      if (code === "UPLOAD_TYPE") setError(t("admin.servicePages.uploadErrorType"));
      else if (code === "UPLOAD_SIZE") setError(t("admin.servicePages.uploadErrorSize"));
      else setError(t("admin.servicePages.uploadError"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="csp-media-field">
      {value?.url && !hidePreview ? (
        value.kind === "video" ? (
          <video className="csp-media-preview" src={value.url} muted controls playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="csp-media-preview" src={value.url} alt="" />
        )
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="csp-inline-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
        >
          <ImagePlus size={16} />
          {t("admin.servicePages.chooseExistingPhoto")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading
            ? t("admin.servicePages.uploading", { n: progress })
            : t("admin.servicePages.uploadNewPhoto")}
        </button>
      </div>
      {uploading ? (
        <div className="csp-upload-track" aria-hidden>
          <span className="csp-upload-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="csp-issues">{error}</p> : null}
      <AdminMediaPicker
        open={pickerOpen}
        title={t("admin.servicePages.chooseExistingPhoto")}
        accept={accept}
        emptyLabel={t("admin.servicePages.mediaEmpty")}
        stacked={stacked}
        onClose={() => setPickerOpen(false)}
        onPick={(media) => {
          onChange(media);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
