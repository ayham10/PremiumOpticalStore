"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import AdminMediaField from "@/components/admin/AdminMediaField";
import { uploadImageBlob, uploadImageFromPc } from "@/lib/admin-media-upload";
import {
  clampImageFocal,
  DEFAULT_IMAGE_FOCAL,
  objectPositionCss,
} from "@/lib/responsive-image";
import { buildHeroVariants } from "@/lib/responsive-image-client";
import { MEDIA_IMAGE_ACCEPT } from "@/lib/media-upload";
import type { CustomPageMediaRef, ImageFocalPoint, MediaItem } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

function FocalPreview({
  src,
  aspect,
  focal,
  label,
  onChange,
}: {
  src: string;
  aspect: string;
  focal: ImageFocalPoint;
  label: string;
  onChange: (focal: ImageFocalPoint) => void;
}) {
  const dragging = useRef(false);

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampImageFocal({
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: (event.clientY - rect.top) / Math.max(rect.height, 1),
      zoom: focal.zoom,
    });
  }

  return (
    <div className="csp-hero-variant">
      <p>{label}</p>
      <div
        className="csp-hero-focal"
        style={{ aspectRatio: aspect }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          onChange(pointFromEvent(event));
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          onChange(pointFromEvent(event));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{
            objectFit: "cover",
            objectPosition: objectPositionCss(focal),
            transform: `scale(${focal.zoom})`,
          }}
        />
      </div>
      <label className="admin-service-field">
        <span className="label">{label} zoom</span>
        <input
          type="range"
          min={1}
          max={2.2}
          step={0.05}
          value={focal.zoom}
          onChange={(event) =>
            onChange(clampImageFocal({ ...focal, zoom: Number(event.target.value) }))
          }
        />
      </label>
    </div>
  );
}

export default function ResponsiveHeroImageField({
  value,
  onChange,
  t,
  folder = "hero",
  acceptVideo = true,
}: {
  value?: CustomPageMediaRef;
  onChange: (media?: CustomPageMediaRef) => void;
  t: Translate;
  folder?: MediaItem["folder"];
  acceptVideo?: boolean;
}) {
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function optimize(next: CustomPageMediaRef) {
    if (next.kind !== "image" || !next.url) {
      onChange(next);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const desktopFocal = clampImageFocal(next.desktopFocal || DEFAULT_IMAGE_FOCAL);
      const mobileFocal = clampImageFocal(next.mobileFocal || DEFAULT_IMAGE_FOCAL);
      const variants = await buildHeroVariants(next.url, desktopFocal, mobileFocal);
      const [desktop, mobile] = await Promise.all([
        uploadImageBlob(variants.desktop, {
          folder,
          alt: "hero-desktop",
          filename: "hero-desktop.webp",
          register: false,
        }),
        uploadImageBlob(variants.mobile, {
          folder,
          alt: "hero-mobile",
          filename: "hero-mobile.webp",
          register: false,
        }),
      ]);
      onChange({
        ...next,
        desktopFocal,
        mobileFocal,
        desktopUrl: desktop.url,
        mobileUrl: mobile.url,
        fit: next.fit || "cover",
      });
    } catch {
      onChange({ ...next, fit: next.fit || "cover" });
      setError(t("admin.servicePages.heroOptimizeFallback"));
    } finally {
      setBusy(false);
    }
  }

  async function replaceVariant(
    file: File | undefined,
    which: "desktop" | "mobile",
  ) {
    if (!file || !value) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadImageFromPc(file, { folder });
      onChange({
        ...value,
        [which === "desktop" ? "desktopUrl" : "mobileUrl"]: uploaded.url,
      });
    } catch {
      setError(t("admin.servicePages.uploadError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="csp-hero-optimize">
      <AdminMediaField
        value={value}
        onChange={(media) => void optimize(media)}
        t={t}
        folder={folder}
        accept={acceptVideo ? "any" : "image"}
      />
      {value?.kind === "image" && value.url ? (
        <>
          <div className="csp-hero-variants">
            <FocalPreview
              src={value.desktopUrl || value.url}
              aspect="16 / 9"
              focal={clampImageFocal(value.desktopFocal)}
              label={t("admin.servicePages.heroDesktop")}
              onChange={(desktopFocal) =>
                onChange({ ...value, desktopFocal })
              }
            />
            <FocalPreview
              src={value.mobileUrl || value.url}
              aspect="9 / 16"
              focal={clampImageFocal(value.mobileFocal)}
              label={t("admin.servicePages.heroMobile")}
              onChange={(mobileFocal) => onChange({ ...value, mobileFocal })}
            />
          </div>
          <p className="admin-muted">{t("admin.servicePages.heroCropHint")}</p>
          <label className="csp-check">
            <input
              type="checkbox"
              checked={value.fit === "contain"}
              onChange={(event) =>
                onChange({
                  ...value,
                  fit: event.target.checked ? "contain" : "cover",
                })
              }
            />
            {t("admin.servicePages.heroFitContain")}
          </label>
          <div className="csp-inline-actions">
            <input
              ref={desktopInput}
              type="file"
              accept={MEDIA_IMAGE_ACCEPT}
              className="hidden"
              onChange={(event) =>
                void replaceVariant(event.target.files?.[0], "desktop")
              }
            />
            <input
              ref={mobileInput}
              type="file"
              accept={MEDIA_IMAGE_ACCEPT}
              className="hidden"
              onChange={(event) =>
                void replaceVariant(event.target.files?.[0], "mobile")
              }
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => desktopInput.current?.click()}
              disabled={busy}
            >
              <Upload size={15} />
              {t("admin.servicePages.heroReplaceDesktop")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => mobileInput.current?.click()}
              disabled={busy}
            >
              <ImagePlus size={15} />
              {t("admin.servicePages.heroReplaceMobile")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void optimize(value)}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {t("admin.servicePages.heroRebuild")}
            </button>
          </div>
        </>
      ) : null}
      {error ? <p className="csp-issues">{error}</p> : null}
    </div>
  );
}
