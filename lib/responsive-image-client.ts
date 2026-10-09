import {
  coverCropRect,
  DESKTOP_HERO_ASPECT,
  DESKTOP_HERO_MAX_WIDTH,
  MOBILE_HERO_ASPECT,
  MOBILE_HERO_MAX_WIDTH,
} from "@/lib/responsive-image";
import type { ImageFocalPoint } from "@/lib/types";

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("IMAGE_LOAD"));
    image.src = src;
  });
  return image;
}

export async function renderCoverVariant(
  source: HTMLImageElement,
  aspect: { width: number; height: number },
  focal: ImageFocalPoint,
  maxWidth: number,
): Promise<Blob> {
  const crop = coverCropRect(
    source.naturalWidth || source.width,
    source.naturalHeight || source.height,
    aspect.width,
    aspect.height,
    focal,
  );
  const scale = Math.min(1, maxWidth / crop.sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.sw * scale));
  canvas.height = Math.max(1, Math.round(crop.sh * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CROP_FAILED");
  context.drawImage(
    source,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.82);
  });
  if (!blob) throw new Error("CROP_FAILED");
  return blob;
}

export async function buildHeroVariants(
  sourceUrl: string,
  desktopFocal: ImageFocalPoint,
  mobileFocal: ImageFocalPoint,
): Promise<{ desktop: Blob; mobile: Blob }> {
  const image = await loadImageElement(sourceUrl);
  const [desktop, mobile] = await Promise.all([
    renderCoverVariant(image, DESKTOP_HERO_ASPECT, desktopFocal, DESKTOP_HERO_MAX_WIDTH),
    renderCoverVariant(image, MOBILE_HERO_ASPECT, mobileFocal, MOBILE_HERO_MAX_WIDTH),
  ]);
  return { desktop, mobile };
}
