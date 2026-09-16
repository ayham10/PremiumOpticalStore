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

const CATEGORY_DEFAULT_ALIASES: Record<string, CategoryDefaultImageKey> = {
  frames: "Frames",
  "prescription glasses": "Frames",
  "eyeglass frames": "Frames",
  sunglasses: "Sunglasses",
  "contact lenses": "Contact Lenses",
  "contact lens": "Contact Lenses",
  lenses: "Contact Lenses",
  contacts: "Contact Lenses",
  "contact-lenses": "Contact Lenses",
  contact_lenses: "Contact Lenses",
};

export function isCategoryDefaultImageKey(
  value: string,
): value is CategoryDefaultImageKey {
  return (CATEGORY_DEFAULT_IMAGE_KEYS as readonly string[]).includes(value);
}

/** Map a product category string onto the Admin default-image key. */
export function resolveCategoryDefaultKey(
  category?: string | null,
): CategoryDefaultImageKey | null {
  if (!category || typeof category !== "string") return null;
  const trimmed = category.trim();
  if (!trimmed) return null;
  if (isCategoryDefaultImageKey(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  for (const key of CATEGORY_DEFAULT_IMAGE_KEYS) {
    if (key.toLowerCase() === lower) return key;
  }
  return CATEGORY_DEFAULT_ALIASES[lower] || null;
}

function isUsableOwnImage(value: string): boolean {
  return Boolean(value.trim());
}

function firstOwnImage(images: string[] | undefined): string {
  const list = Array.isArray(images)
    ? images
    : typeof images === "string"
      ? [images]
      : [];
  for (const value of list) {
    if (typeof value === "string" && isUsableOwnImage(value)) {
      return value.trim();
    }
  }
  return "";
}

export function productOwnImage(images?: string[] | null): string {
  return firstOwnImage(images || undefined);
}

export function categoryDefaultForProduct(
  product: { category?: string },
  defaults?: CategoryDefaultImages | null,
): string {
  const key = resolveCategoryDefaultKey(product.category);
  if (!key) return "";
  const fallback = defaults?.[key]?.trim();
  return fallback || "";
}

export function mergeCategoryDefaultImages(
  incoming?: CategoryDefaultImages | null,
): CategoryDefaultImages {
  const next: CategoryDefaultImages = {};
  if (!incoming || typeof incoming !== "object") return next;
  const record = incoming as Record<string, unknown>;
  for (const key of CATEGORY_DEFAULT_IMAGE_KEYS) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim()) {
      next[key] = raw.trim();
    }
  }
  for (const [rawKey, rawValue] of Object.entries(record)) {
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;
    const mapped = resolveCategoryDefaultKey(rawKey);
    if (mapped && !next[mapped]) {
      next[mapped] = rawValue.trim();
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

  const fallback = categoryDefaultForProduct(product, defaults);
  if (fallback) return fallback;

  return PLACEHOLDER_PRODUCT_IMAGE;
}

export function productDisplayGallery(
  product: { images?: string[]; category?: string },
  defaults?: CategoryDefaultImages | null,
): string[] {
  const own = (Array.isArray(product.images) ? product.images : []).filter(
    (value): value is string =>
      typeof value === "string" && isUsableOwnImage(value),
  );
  if (own.length) return own.map((value) => value.trim());
  return [productDisplayImage(product, defaults)];
}

/** Storefront-only image list. Does not change the stored product record. */
export function storefrontProductImages(
  product: { images?: string[]; category?: string },
  defaults?: CategoryDefaultImages | null,
): string[] {
  const own = (Array.isArray(product.images) ? product.images : [])
    .filter(
      (value): value is string =>
        typeof value === "string" && isUsableOwnImage(value),
    )
    .map((value) => value.trim());
  if (own.length) return own;
  const fallback = categoryDefaultForProduct(product, defaults);
  return fallback ? [fallback] : [];
}
