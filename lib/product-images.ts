import type {
  CategoryDefaultImageKey,
  CategoryDefaultImages,
} from "@/lib/types";

export const PLACEHOLDER_PRODUCT_IMAGE = "/images/placeholder-frame.svg";

export const CATEGORY_DEFAULT_IMAGE_KEYS = [
  "Frames",
  "Sunglasses",
  "Contact Lenses",
] as const satisfies readonly CategoryDefaultImageKey[];

function firstOwnImage(images: string[] | undefined): string {
  if (!Array.isArray(images)) return "";
  for (const value of images) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function mergeCategoryDefaultImages(
  incoming?: CategoryDefaultImages | null,
): CategoryDefaultImages {
  const next: CategoryDefaultImages = {};
  if (!incoming || typeof incoming !== "object") return next;
  for (const key of CATEGORY_DEFAULT_IMAGE_KEYS) {
    const raw = incoming[key];
    if (typeof raw === "string" && raw.trim()) {
      next[key] = raw.trim();
    }
  }
  return next;
}

export function productDisplayImage(
  product: { images?: string[]; category?: string },
  defaults?: CategoryDefaultImages | null,
): string {
  const own = firstOwnImage(product.images);
  if (own) return own;

  const category = product.category;
  if (
    category === "Frames" ||
    category === "Sunglasses" ||
    category === "Contact Lenses"
  ) {
    const fallback = defaults?.[category]?.trim();
    if (fallback) return fallback;
  }

  return PLACEHOLDER_PRODUCT_IMAGE;
}

export function productDisplayGallery(
  product: { images?: string[]; category?: string },
  defaults?: CategoryDefaultImages | null,
): string[] {
  const own = (product.images || []).filter(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  );
  if (own.length) return own;
  return [productDisplayImage(product, defaults)];
}
