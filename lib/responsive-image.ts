import type { CustomPageMediaRef, ImageFocalPoint } from "@/lib/types";

export const DEFAULT_IMAGE_FOCAL: ImageFocalPoint = {
  x: 0.5,
  y: 0.38,
  zoom: 1,
};

export const DESKTOP_HERO_ASPECT = { width: 16, height: 9 };
export const MOBILE_HERO_ASPECT = { width: 9, height: 16 };
export const DESKTOP_HERO_MAX_WIDTH = 1920;
export const MOBILE_HERO_MAX_WIDTH = 1080;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampImageFocal(
  value?: Partial<ImageFocalPoint> | null,
): ImageFocalPoint {
  return {
    x: clamp(Number(value?.x ?? DEFAULT_IMAGE_FOCAL.x), 0, 1),
    y: clamp(Number(value?.y ?? DEFAULT_IMAGE_FOCAL.y), 0, 1),
    zoom: clamp(Number(value?.zoom ?? DEFAULT_IMAGE_FOCAL.zoom), 1, 2.5),
  };
}

export function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspectWidth: number,
  aspectHeight: number,
  focal?: Partial<ImageFocalPoint> | null,
): { sx: number; sy: number; sw: number; sh: number } {
  const point = clampImageFocal(focal);
  const target = aspectWidth / aspectHeight;
  const source = sourceWidth / Math.max(sourceHeight, 1);
  let sw: number;
  let sh: number;
  if (source > target) {
    sh = sourceHeight / point.zoom;
    sw = sh * target;
  } else {
    sw = sourceWidth / point.zoom;
    sh = sw / target;
  }
  sw = Math.min(Math.max(1, sw), sourceWidth);
  sh = Math.min(Math.max(1, sh), sourceHeight);
  return {
    sx: clamp(point.x * sourceWidth - sw / 2, 0, sourceWidth - sw),
    sy: clamp(point.y * sourceHeight - sh / 2, 0, sourceHeight - sh),
    sw,
    sh,
  };
}

export function objectPositionCss(focal?: Partial<ImageFocalPoint> | null): string {
  const point = clampImageFocal(focal);
  return `${Math.round(point.x * 100)}% ${Math.round(point.y * 100)}%`;
}

export function mediaUrlForViewport(
  media: CustomPageMediaRef | undefined,
  viewport: "mobile" | "desktop",
): string {
  if (!media?.url) return "";
  if (media.kind === "video") return media.url;
  if (viewport === "mobile") return media.mobileUrl || media.url;
  return media.desktopUrl || media.url;
}

export function hasGeneratedHeroVariants(media?: CustomPageMediaRef): boolean {
  return Boolean(media?.desktopUrl || media?.mobileUrl);
}
