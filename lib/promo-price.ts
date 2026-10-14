import type { Product, Promotion } from "@/lib/types";

export function computeDiscountedPrice(
  sellingPrice: number,
  promo: Promotion,
): number {
  const type = promo.discountType;
  const value = promo.discountValue;

  if (type === "percentage" && typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, Math.round(sellingPrice * (1 - value / 100)));
  }
  if (type === "fixed" && typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, Math.round(sellingPrice - value));
  }

  const d = promo.discount || "";
  const pct = d.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    return Math.max(0, Math.round(sellingPrice * (1 - parseFloat(pct[1]) / 100)));
  }
  const fixed = d.match(/(?:₪|NIS|ILS)?\s*(\d+(?:\.\d+)?)/i);
  if (fixed) {
    return Math.max(0, Math.round(sellingPrice - parseFloat(fixed[1])));
  }
  return sellingPrice;
}
