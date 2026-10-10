"use client";

import { useEffect, useState, type ReactNode } from "react";
import ResponsiveHeroImage from "@/components/media/ResponsiveHeroImage";
import { hasCustomHeroMedia } from "@/lib/page-hero-media";
import type { CustomPageMediaRef } from "@/lib/types";

export default function PageHeroMedia({
  media,
  alt,
  className,
  videoClassName,
  fallback,
}: {
  media?: CustomPageMediaRef | null;
  alt: string;
  className?: string;
  videoClassName?: string;
  fallback: ReactNode;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!hasCustomHeroMedia(media)) return <>{fallback}</>;

  if (media.kind === "image") {
    return (
      <ResponsiveHeroImage media={media} alt={alt} className={className} />
    );
  }

  const poster = media.desktopUrl || media.mobileUrl || undefined;
  if (reduceMotion && poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={poster} alt={alt} className={className} />
    );
  }
  if (reduceMotion) return <>{fallback}</>;

  return (
    <video
      className={videoClassName}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={alt}
    >
      <source
        src={media.url}
        type={media.url.endsWith(".webm") ? "video/webm" : "video/mp4"}
      />
    </video>
  );
}
