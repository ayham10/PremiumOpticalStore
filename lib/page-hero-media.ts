import type { CustomPageMediaRef } from "@/lib/types";

export const DEFAULT_CATALOG_HERO_IMAGE = "/images/store-catalog-hero.jpg";

export const DEFAULT_SUNGLASSES_HERO_VIDEO = "/videos/sunglasses-hero.mp4";
export const DEFAULT_SUNGLASSES_HERO_POSTER =
  "/images/sunglasses-hero-poster.jpg";
export const DEFAULT_SUNGLASSES_HERO_LOOP_TAIL_SECONDS = 5;

export const DEFAULT_FRAMES_HERO_VIDEO = "/videos/premium-frames.mp4";
export const DEFAULT_FRAMES_HERO_POSTER = "/images/premium-video-poster.jpg";

export function hasCustomHeroMedia(
  media?: CustomPageMediaRef | null,
): media is CustomPageMediaRef {
  return Boolean(media?.url?.trim());
}

export function catalogHeroImage(
  media?: CustomPageMediaRef | null,
): CustomPageMediaRef | undefined {
  if (!hasCustomHeroMedia(media) || media.kind === "video") return undefined;
  return media;
}

export function editorSectionDisplayName(
  adminName: string | undefined,
  fallback: string,
): string {
  const custom = adminName?.trim();
  return custom || fallback;
}
