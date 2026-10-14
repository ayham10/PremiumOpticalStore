import { slugify } from "@/lib/format";

export const PRODUCT_NUMBER_PREFIX = "RB";
export const PRODUCT_NUMBER_PATTERN = /^RB-(\d+)$/i;

export function normalizeProductNumber(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(PRODUCT_NUMBER_PATTERN);
  if (match) return `${PRODUCT_NUMBER_PREFIX}-${Number.parseInt(match[1], 10)}`;
  return trimmed;
}

export function productNumberKey(value: string): string {
  return normalizeProductNumber(value).toLowerCase();
}

export function usedProductNumbers(
  products: Array<{ id?: string; sku?: string }>,
  excludeId?: string,
): Set<string> {
  const used = new Set<string>();
  for (const product of products) {
    if (excludeId && product.id === excludeId) continue;
    const sku = product.sku?.trim();
    if (!sku) continue;
    used.add(productNumberKey(sku));
  }
  return used;
}

export function isProductNumberTaken(
  sku: string,
  products: Array<{ id?: string; sku?: string }>,
  excludeId?: string,
): boolean {
  const key = productNumberKey(sku);
  if (!key) return false;
  return usedProductNumbers(products, excludeId).has(key);
}

/** Lowest unused RB-n, including previously released numbers. */
export function allocateProductNumber(
  products: Array<{ id?: string; sku?: string }>,
  excludeId?: string,
): string {
  const used = usedProductNumbers(products, excludeId);
  let n = 1;
  while (used.has(productNumberKey(`${PRODUCT_NUMBER_PREFIX}-${n}`))) {
    n += 1;
  }
  return `${PRODUCT_NUMBER_PREFIX}-${n}`;
}

export function resolveProductNumber(
  requested: string | undefined,
  products: Array<{ id?: string; sku?: string }>,
  excludeId?: string,
  reallocateIfTaken = false,
): string {
  const requestedNorm = requested?.trim()
    ? normalizeProductNumber(requested)
    : "";
  if (requestedNorm && !isProductNumberTaken(requestedNorm, products, excludeId)) {
    return requestedNorm;
  }
  if (requestedNorm && !reallocateIfTaken) {
    throw new Error("PRODUCT_NUMBER_TAKEN");
  }
  return allocateProductNumber(products, excludeId);
}

export function uniqueProductSlug(
  name: string,
  products: Array<{ id?: string; slug?: string }>,
  excludeId?: string,
  preferred?: string,
): string {
  const root = slugify(preferred || name) || "product";
  const taken = (slug: string) =>
    products.some((product) => product.id !== excludeId && product.slug === slug);
  if (preferred?.trim() && !taken(preferred.trim())) return preferred.trim();
  let slug = root;
  let n = 2;
  while (taken(slug)) {
    slug = `${root}-${n}`;
    n += 1;
  }
  return slug;
}

export function ensureProductNumbers<T extends { id: string; sku?: string }>(
  products: T[],
): T[] {
  const used = usedProductNumbers(products);
  return products.map((product) => {
    if (product.sku?.trim()) return product;
    let n = 1;
    let sku = `${PRODUCT_NUMBER_PREFIX}-${n}`;
    while (used.has(productNumberKey(sku))) {
      n += 1;
      sku = `${PRODUCT_NUMBER_PREFIX}-${n}`;
    }
    used.add(productNumberKey(sku));
    return { ...product, sku };
  });
}
