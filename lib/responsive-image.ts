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

/** Smallest useful zoom-out relative to the fitted/cover scale. */
export const IMAGE_ZOOM_MIN = 0.55;
/** Fitted cover/contain scale. Slider 50% maps here — not CSS scale(0.5). */
export const IMAGE_ZOOM_NEUTRAL = 1;
/** Strongest zoom-in stored on a focal. */
export const IMAGE_ZOOM_MAX = 2.5;
/** Slider thumb at 100% — slightly under storage max so legacy 2.5 still clamps safely. */
export const IMAGE_ZOOM_SLIDER_MAX = 2.2;
export const IMAGE_ZOOM_SLIDER_NEUTRAL = 50;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampImageFocal(
  value?: Partial<ImageFocalPoint> | null,
): ImageFocalPoint {
  return {
    x: clamp(Number(value?.x ?? DEFAULT_IMAGE_FOCAL.x), 0, 1),
    y: clamp(Number(value?.y ?? DEFAULT_IMAGE_FOCAL.y), 0, 1),
    zoom: clamp(
      Number(value?.zoom ?? DEFAULT_IMAGE_FOCAL.zoom),
      IMAGE_ZOOM_MIN,
      IMAGE_ZOOM_MAX,
    ),
  };
}

/** Cover-crop bake cannot zoom out; treat sub-neutral zoom as the fitted crop. */
export function coverCropZoom(zoom: number): number {
  return Math.max(IMAGE_ZOOM_NEUTRAL, clamp(zoom, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX));
}

export function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  aspectWidth: number,
  aspectHeight: number,
  focal?: Partial<ImageFocalPoint> | null,
): { sx: number; sy: number; sw: number; sh: number } {
  const point = clampImageFocal(focal);
  const zoom = coverCropZoom(point.zoom);
  const target = aspectWidth / aspectHeight;
  const source = sourceWidth / Math.max(sourceHeight, 1);
  let sw: number;
  let sh: number;
  if (source > target) {
    sh = sourceHeight / zoom;
    sw = sh * target;
  } else {
    sw = sourceWidth / zoom;
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

/**
 * Map a stored render scale to the 0–100 editor slider.
 * zoom=1 (fitted) is always 50%. Legacy 1–2.5 values stay visually unchanged.
 */
export function zoomToSliderPercent(zoom: number): number {
  const z = clamp(Number(zoom) || IMAGE_ZOOM_NEUTRAL, IMAGE_ZOOM_MIN, IMAGE_ZOOM_SLIDER_MAX);
  if (z <= IMAGE_ZOOM_NEUTRAL) {
    const span = IMAGE_ZOOM_NEUTRAL - IMAGE_ZOOM_MIN;
    return Math.round(((z - IMAGE_ZOOM_MIN) / span) * IMAGE_ZOOM_SLIDER_NEUTRAL);
  }
  const span = IMAGE_ZOOM_SLIDER_MAX - IMAGE_ZOOM_NEUTRAL;
  return Math.round(
    IMAGE_ZOOM_SLIDER_NEUTRAL +
      ((z - IMAGE_ZOOM_NEUTRAL) / span) * (100 - IMAGE_ZOOM_SLIDER_NEUTRAL),
  );
}

/** Inverse of zoomToSliderPercent. 50 → 1 (fitted), 0 → zoom-out, 100 → zoom-in. */
export function sliderPercentToZoom(percent: number): number {
  const p = clamp(Number(percent) || 0, 0, 100);
  if (p <= IMAGE_ZOOM_SLIDER_NEUTRAL) {
    const t = p / IMAGE_ZOOM_SLIDER_NEUTRAL;
    return IMAGE_ZOOM_MIN + t * (IMAGE_ZOOM_NEUTRAL - IMAGE_ZOOM_MIN);
  }
  const t = (p - IMAGE_ZOOM_SLIDER_NEUTRAL) / (100 - IMAGE_ZOOM_SLIDER_NEUTRAL);
  return IMAGE_ZOOM_NEUTRAL + t * (IMAGE_ZOOM_SLIDER_MAX - IMAGE_ZOOM_NEUTRAL);
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

/**
 * Live CSS zoom/position is required when baked cover crops would hide
 * zoom-out, contain fit, or a newly selected image that was never cropped.
 */
export function shouldUseLiveHeroFocal(media?: CustomPageMediaRef): boolean {
  if (!media?.url || media.kind === "video") return false;
  if (media.fit === "contain") return true;
  if (!hasGeneratedHeroVariants(media)) return true;
  const desktop = clampImageFocal(media.desktopFocal);
  const mobile = clampImageFocal(media.mobileFocal);
  return desktop.zoom < IMAGE_ZOOM_NEUTRAL || mobile.zoom < IMAGE_ZOOM_NEUTRAL;
}

export function heroDisplayUrl(
  media: CustomPageMediaRef | undefined,
  viewport: "mobile" | "desktop",
): string {
  if (!media?.url) return "";
  if (shouldUseLiveHeroFocal(media)) return media.url;
  return mediaUrlForViewport(media, viewport);
}

export function liveHeroFocalVars(
  desktop?: Partial<ImageFocalPoint> | null,
  mobile?: Partial<ImageFocalPoint> | null,
): Record<string, string> {
  const desk = clampImageFocal(desktop);
  const mob = clampImageFocal(mobile);
  return {
    "--hero-pos-d": objectPositionCss(desk),
    "--hero-zoom-d": String(desk.zoom),
    "--hero-pos-m": objectPositionCss(mob),
    "--hero-zoom-m": String(mob.zoom),
  };
}

/** New upload / library pick / Auto Fit: fitted scale, slider at 50%. */
export function freshHeroImage(
  next: Pick<CustomPageMediaRef, "url" | "kind" | "mediaId" | "fit">,
): CustomPageMediaRef {
  if (next.kind === "video") {
    return { kind: "video", url: next.url, mediaId: next.mediaId };
  }
  return {
    kind: "image",
    url: next.url,
    mediaId: next.mediaId,
    desktopFocal: { ...DEFAULT_IMAGE_FOCAL },
    mobileFocal: { ...DEFAULT_IMAGE_FOCAL },
    fit: next.fit === "contain" ? "contain" : "cover",
  };
}

export function resetHeroFocals(media: CustomPageMediaRef): CustomPageMediaRef {
  if (media.kind === "video") return media;
  return {
    ...media,
    desktopFocal: { ...DEFAULT_IMAGE_FOCAL },
    mobileFocal: { ...DEFAULT_IMAGE_FOCAL },
    desktopUrl: undefined,
    mobileUrl: undefined,
  };
}
