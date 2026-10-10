"use client";

import { useState } from "react";
import {
  hasGeneratedHeroVariants,
  heroDisplayUrl,
  liveHeroFocalVars,
  objectPositionCss,
  shouldUseLiveHeroFocal,
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
  const live = shouldUseLiveHeroFocal(media);
  const desktop = heroDisplayUrl(media, "desktop");
  const mobile = heroDisplayUrl(media, "mobile");
  const fit = media.fit === "contain" ? "object-contain" : "object-cover";
  const position = objectPositionCss(
    hasGeneratedHeroVariants(media) && !live
      ? { x: 0.5, y: 0.5, zoom: 1 }
      : media.desktopFocal,
  );
  const liveVars = live
    ? liveHeroFocalVars(media.desktopFocal, media.mobileFocal)
    : undefined;
  const imageClass = `${fit} ${live ? "csp-hero-live" : ""} ${className || ""}`.trim();

  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobile} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={desktop}
        alt={alt}
        className={imageClass}
        style={{
          objectPosition: live ? undefined : position,
          ...(liveVars || {}),
        }}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
