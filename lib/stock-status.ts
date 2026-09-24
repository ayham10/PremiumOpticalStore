export type StockLevel = "in" | "low" | "out";

/** Used when a product has no positive per-product minimumStock. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function productStockQuantity(stockQuantity?: number | null): number {
  const qty = Number(stockQuantity);
  return Number.isFinite(qty) ? qty : 0;
}

/** Reuse Product.minimumStock; fall back to 5 when unset or non-positive. */
export function productLowStockThreshold(minimumStock?: number | null): number {
  const threshold = Number(minimumStock);
  return Number.isFinite(threshold) && threshold > 0
    ? threshold
    : DEFAULT_LOW_STOCK_THRESHOLD;
}

export function getStockLevel(
  stockQuantity?: number | null,
  minimumStock?: number | null,
): StockLevel {
  const qty = productStockQuantity(stockQuantity);
  if (qty <= 0) return "out";
  if (qty <= productLowStockThreshold(minimumStock)) return "low";
  return "in";
}
