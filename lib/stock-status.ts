export type StockLevel = "in" | "low" | "out";

/** Used only when a product has no saved minimumStock. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function productStockQuantity(stockQuantity?: number | null): number {
  const qty = Number(stockQuantity);
  return Number.isFinite(qty) ? qty : 0;
}

/** Reuse Product.minimumStock, including 0. Fall back to 5 only when unset. */
export function productLowStockThreshold(minimumStock?: number | null): number {
  if (minimumStock === null || minimumStock === undefined) {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
  const threshold = Number(minimumStock);
  if (!Number.isFinite(threshold)) return DEFAULT_LOW_STOCK_THRESHOLD;
  return Math.max(0, threshold);
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
