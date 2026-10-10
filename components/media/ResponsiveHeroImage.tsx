"use client";

import { useState } from "react";
import {
  hasGeneratedHeroVariants,
  mediaUrlForViewport,
  objectPositionCss,
} from "@/lib/responsive-image";
import type { CustomPageMediaRef } from "@/lib/types";

export default function ResponsiveHeroImage({
  media,
  alt,
  className,
}: {
  media?: CustomPageMediaRef;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!media?.url || media.kind === "video" || failed) return null;
  const desktop = mediaUrlForViewport(media, "desktop");
  const mobile = mediaUrlForViewport(media, "mobile");
  const fit = media.fit === "contain" ? "object-contain" : "object-cover";
  const position = objectPositionCss(
    hasGeneratedHeroVariants(media) ? { x: 0.5, y: 0.5, zoom: 1 } : media.desktopFocal,
  );
  const imageClass = `${fit} ${className || ""}`.trim();

  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobile} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={desktop}
        alt={alt}
        className={imageClass}
        style={{ objectPosition: position }}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
