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

const CONTACT_LENS_CATEGORY_ALIASES = new Set([
  "contact lenses",
  "contact lens",
  "lenses",
  "contacts",
  "contact-lenses",
  "contact_lenses",
]);

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
  if (CONTACT_LENS_CATEGORY_ALIASES.has(lower)) return "Contact Lenses";
  return null;
}

function isUsableOwnImage(value: string): boolean {
  const url = value.trim();
  if (!url) return false;
  if (url === PLACEHOLDER_PRODUCT_IMAGE) return false;
  if (/^(undefined|null|none|#)$/i.test(url)) return false;
  // Seed/local contact-lens files are not in /public, so they render broken
  // and must not block the Contact Lenses category default.
  if (/^\/images\/contact-lenses\//i.test(url)) return false;
  return true;
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
      continue;
    }
  }
  // Recover Contact Lenses if the store saved it under a nearby alias.
  if (!next["Contact Lenses"]) {
    for (const [rawKey, rawValue] of Object.entries(record)) {
      if (typeof rawValue !== "string" || !rawValue.trim()) continue;
      if (resolveCategoryDefaultKey(rawKey) === "Contact Lenses") {
        next["Contact Lenses"] = rawValue.trim();
        break;
      }
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

  const key = resolveCategoryDefaultKey(product.category);
  if (key) {
    const fallback = defaults?.[key]?.trim();
    if (fallback) return fallback;
  }

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
