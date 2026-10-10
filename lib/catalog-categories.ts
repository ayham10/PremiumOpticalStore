import type { Locale } from "@/lib/i18n/config";
import { isLocale } from "@/lib/i18n/config";
import type {
  CatalogCategory,
  CatalogCategoryNames,
  Product,
  ProductCategory,
} from "@/lib/types";
import { PRODUCT_TYPES } from "@/lib/types";

export const SYSTEM_CATEGORY_IDS = PRODUCT_TYPES;
export const MAX_CATEGORY_NAME = 80;
export const MAX_CUSTOM_CATEGORIES = 40;

export const SYSTEM_CATEGORY_NAMES: Record<ProductCategory, CatalogCategoryNames> = {
  "Prescription Glasses": {
    ar: "نظارات طبية",
    he: "משקפי ראייה",
    en: "Prescription Glasses",
  },
  Sunglasses: {
    ar: "نظارات شمسية",
    he: "משקפי שמש",
    en: "Sunglasses",
  },
  "Contact Lenses": {
    ar: "عدسات لاصقة",
    he: "עדשות מגע",
    en: "Contact Lenses",
  },
  Frames: {
    ar: "إطارات",
    he: "מסגרות",
    en: "Frames",
  },
  Accessories: {
    ar: "إكسسوارات",
    he: "אביזרים",
    en: "Accessories",
  },
  "Cleaning Products": {
    ar: "منتجات تنظيف",
    he: "מוצרי ניקוי",
    en: "Cleaning Products",
  },
};

export function isProductType(value: unknown): value is ProductCategory {
  return (
    typeof value === "string" &&
    (PRODUCT_TYPES as readonly string[]).includes(value)
  );
}

export function isSystemCategoryId(id: string): boolean {
  return isProductType(id);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newCatalogCategoryId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `cat_${toHex(bytes)}`;
}

export function createCatalogCategory(
  names: CatalogCategoryNames,
  now = new Date().toISOString(),
): CatalogCategory {
  return {
    id: newCatalogCategoryId(),
    names: sanitizeCategoryNames(names),
    showInMainCatalog: false,
    system: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeCategoryName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CATEGORY_NAME);
}

export function sanitizeCategoryNames(
  raw: unknown,
  existing?: CatalogCategoryNames,
): CatalogCategoryNames {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const next: CatalogCategoryNames = {
    ar: sanitizeCategoryName(record.ar) || existing?.ar || "",
    he: sanitizeCategoryName(record.he) || existing?.he || "",
    en: sanitizeCategoryName(record.en) || existing?.en || "",
  };
  return next;
}

export function categoryLabel(
  category: Pick<CatalogCategory, "id" | "names">,
  locale: Locale | string,
): string {
  const key: Locale = isLocale(locale) ? locale : "ar";
  const names = category.names || { ar: "", he: "", en: "" };
  return (
    names[key]?.trim() ||
    names.ar?.trim() ||
    names.en?.trim() ||
    names.he?.trim() ||
    category.id
  );
}

export function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function productCatalogIds(product: {
  category?: string;
  categoryIds?: string[] | null;
}): string[] {
  const extras = Array.isArray(product.categoryIds) ? product.categoryIds : [];
  const type = isProductType(product.category) ? product.category : null;
  return uniqueIds([...(type ? [type] : []), ...extras.map((id) => String(id).trim())]);
}

export function productBelongsToCategory(
  product: { category?: string; categoryIds?: string[] | null },
  categoryId: string,
): boolean {
  if (!categoryId) return false;
  return productCatalogIds(product).includes(categoryId);
}

export function sanitizeCategoryIds(
  raw: unknown,
  knownIds: Set<string>,
  type: ProductCategory,
): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const extras = list
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id && knownIds.has(id) && id !== type);
  return uniqueIds(extras);
}

export function isPublishedProduct(product: Pick<Product, "status">): boolean {
  return product.status === "active";
}

export function productVisibleInMainCatalog(
  product: Pick<Product, "status" | "category" | "categoryIds">,
  categories: CatalogCategory[],
): boolean {
  if (!isPublishedProduct(product)) return false;
  const visible = new Set(
    categories.filter((item) => item.showInMainCatalog).map((item) => item.id),
  );
  return productCatalogIds(product).some((id) => visible.has(id));
}

export function publicCatalogCategories(categories: CatalogCategory[]): CatalogCategory[] {
  return categories.filter((item) => item.showInMainCatalog);
}

export function visibleCategoryIdSet(categories: CatalogCategory[]): Set<string> {
  return new Set(publicCatalogCategories(categories).map((item) => item.id));
}

export function publicProductCategoryIds(
  product: Pick<Product, "category" | "categoryIds">,
  categories: CatalogCategory[],
): string[] {
  const visible = visibleCategoryIdSet(categories);
  return productCatalogIds(product).filter((id) => visible.has(id));
}

export function countCategoryProducts(
  products: Array<{ category?: string; categoryIds?: string[] | null }>,
  categoryId: string,
): number {
  return products.filter((product) => productBelongsToCategory(product, categoryId)).length;
}

function defaultSystemCategory(id: ProductCategory, now: string): CatalogCategory {
  return {
    id,
    names: { ...SYSTEM_CATEGORY_NAMES[id] },
    showInMainCatalog: true,
    system: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseCatalogCategory(raw: unknown): CatalogCategory | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!id || id.length > 80) return null;
  const names = sanitizeCategoryNames(item.names);
  if (!names.ar && !names.he && !names.en) return null;
  const now = new Date().toISOString();
  return {
    id,
    names,
    showInMainCatalog: item.showInMainCatalog === true,
    system: isSystemCategoryId(id) ? true : item.system === true,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
  };
}

export function mergeCatalogCategories(saved: unknown): CatalogCategory[] {
  const now = "2020-01-01T00:00:00.000Z";
  const incoming = Array.isArray(saved) ? saved : [];
  const byId = new Map<string, CatalogCategory>();
  for (const row of incoming) {
    const parsed = parseCatalogCategory(row);
    if (!parsed || byId.has(parsed.id)) continue;
    byId.set(parsed.id, parsed);
  }

  const merged: CatalogCategory[] = [];
  for (const id of SYSTEM_CATEGORY_IDS) {
    const existing = byId.get(id);
    const fallback = defaultSystemCategory(id, now);
    if (existing) {
      merged.push({
        ...existing,
        id,
        system: true,
        names: {
          ar: existing.names.ar || fallback.names.ar,
          he: existing.names.he || fallback.names.he,
          en: existing.names.en || fallback.names.en,
        },
      });
      byId.delete(id);
    } else {
      merged.push(fallback);
    }
  }

  for (const item of byId.values()) {
    if (isSystemCategoryId(item.id)) continue;
    merged.push({ ...item, system: false });
  }
  return merged;
}

export function toPublicCategory(category: CatalogCategory, locale: Locale | string) {
  return {
    id: category.id,
    name: categoryLabel(category, locale),
    showInMainCatalog: category.showInMainCatalog,
  };
}

export function namesHaveContent(names: CatalogCategoryNames): boolean {
  return Boolean(names.ar.trim() || names.he.trim() || names.en.trim());
}

export function filterProductsForRequest(opts: {
  products: Product[];
  categories: CatalogCategory[];
  requestedCategoryIds: string[];
  admin: boolean;
}): Product[] {
  const { products, categories, requestedCategoryIds, admin } = opts;
  const known = new Set(categories.map((item) => item.id));
  const requested = uniqueIds(
    requestedCategoryIds
      .map((id) => String(id || "").trim())
      .filter((id) => known.has(id) || isProductType(id)),
  );

  let list = admin
    ? products
    : products.filter((product) => product.status === "active" || product.status === "out_of_stock");

  if (requested.length === 0) {
    return admin
      ? list
      : list.filter((product) => productVisibleInMainCatalog(product, categories));
  }

  if (admin) {
    return list.filter((product) =>
      requested.some((id) => productBelongsToCategory(product, id)),
    );
  }

  const types = requested.filter(isProductType);
  const visibleCustom = requested.filter(
    (id) => !isProductType(id) && categories.some((item) => item.id === id && item.showInMainCatalog),
  );

  if (types.length > 0 && visibleCustom.length === 0 && requested.every(isProductType)) {
    return list.filter((product) => types.includes(product.category));
  }

  const allowed = uniqueIds([...types, ...visibleCustom]);
  if (allowed.length === 0) return [];
  return list.filter((product) =>
    allowed.some((id) => productBelongsToCategory(product, id)),
  );
}

export function applyCategoryDelete(
  categories: CatalogCategory[],
  products: Product[],
  id: string,
  opts: { removeMemberships?: boolean; reassignTo?: string } = {},
): { categories: CatalogCategory[]; products: Product[] } {
  if (isSystemCategoryId(id)) throw new Error("SYSTEM");
  if (!categories.some((item) => item.id === id)) throw new Error("NOT_FOUND");
  const assigned = products.filter((product) => productBelongsToCategory(product, id));
  if (assigned.length && !opts.removeMemberships && !opts.reassignTo) {
    throw new Error("HAS_PRODUCTS");
  }

  let nextProducts = products;
  const reassignTo = opts.reassignTo;
  if (reassignTo) {
    if (reassignTo === id || !categories.some((item) => item.id === reassignTo)) {
      throw new Error("INVALID_TARGET");
    }
    nextProducts = products.map((product) => {
      if (!productBelongsToCategory(product, id)) return product;
      const nextIds = (product.categoryIds || []).filter((item) => item !== id);
      if (reassignTo !== product.category && !nextIds.includes(reassignTo)) {
        nextIds.push(reassignTo);
      }
      return { ...product, categoryIds: nextIds };
    });
  } else if (opts.removeMemberships) {
    nextProducts = products.map((product) => {
      if (!product.categoryIds?.includes(id)) return product;
      return {
        ...product,
        categoryIds: product.categoryIds.filter((item) => item !== id),
      };
    });
  }

  return {
    categories: categories.filter((item) => item.id !== id),
    products: nextProducts,
  };
}
