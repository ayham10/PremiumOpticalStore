"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";
import {
  clampProductImageFocal,
  productImageStyle,
} from "@/lib/product-images";
import {
  sliderPercentToZoom,
  zoomToSliderPercent,
} from "@/lib/responsive-image";
import type { ImageFocalPoint } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function ProductImageFocalEditor({
  src,
  focal,
  isMain,
  t,
  onChange,
}: {
  src: string;
  focal: ImageFocalPoint;
  isMain?: boolean;
  t?: Translate;
  onChange: (focal: ImageFocalPoint) => void;
}) {
  const dragging = useRef(false);
  const zoomPercent = zoomToSliderPercent(focal.zoom);
  const previewStyle = productImageStyle(focal, { preview: true });

  function pointFromEvent(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampProductImageFocal({
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: (event.clientY - rect.top) / Math.max(rect.height, 1),
      zoom: focal.zoom,
    });
  }

  return (
    <div className="admin-pe-focal">
      <p className="admin-pe-focal-title">
        {isMain ? "ضبط الصورة الرئيسية" : "ضبط الصورة"}
      </p>
      <p className="admin-pe-lead">
        الصورة الأصلية محفوظة. المعاينة تعرض الشكل النهائي في الكتالوج.
      </p>
      <div className="csp-hero-variant">
        <p>المعاينة</p>
        <div className="csp-hero-focal-wrap">
          <div
            className="csp-hero-focal admin-pe-focal-preview"
            style={{ "--hero-aw": 1, "--hero-ah": 1 } as CSSProperties}
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
            <img src={src} alt="" style={previewStyle} />
          </div>
        </div>
        <label className="csp-hero-zoom">
          <span className="label">
            {t
              ? t("admin.servicePages.heroZoom", { n: zoomPercent })
              : `التكبير: ${zoomPercent}٪`}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            dir="ltr"
            value={zoomPercent}
            onChange={(event) =>
              onChange(
                clampProductImageFocal({
                  ...focal,
                  zoom: sliderPercentToZoom(Number(event.target.value)),
                }),
              )
            }
          />
        </label>
        <div className="csp-hero-pos">
          <label>
            <span className="label">
              {t ? t("admin.servicePages.heroPositionX") : "أفقي (يمين / يسار)"}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              dir="ltr"
              value={Math.round(focal.x * 100)}
              onChange={(event) =>
                onChange(
                  clampProductImageFocal({
                    ...focal,
                    x: Number(event.target.value) / 100,
                  }),
                )
              }
            />
          </label>
          <label>
            <span className="label">
              {t ? t("admin.servicePages.heroPositionY") : "عمودي (أعلى / أسفل)"}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              dir="ltr"
              value={Math.round(focal.y * 100)}
              onChange={(event) =>
                onChange(
                  clampProductImageFocal({
                    ...focal,
                    y: Number(event.target.value) / 100,
                  }),
                )
              }
            />
          </label>
        </div>
      </div>
    </div>
  );
}
