import { isPromotionActive } from "@/lib/appointments";
import type { Product, Promotion } from "@/lib/types";

export type PromoSlideData = {
  promotion: Promotion;
  products: Product[];
};

/** Filter catalogue products for a promotion's scope. */
export function productsForPromotion(
  promo: Promotion,
  products: Product[],
): Product[] {
  const scope = promo.scope || "all";
  if (scope === "specific") {
    const ids = new Set(promo.productIds || []);
    return products.filter((p) => ids.has(p.id));
  }
  if (scope === "sunglasses") {
    return products.filter((p) => p.category === "Sunglasses");
  }
  if (scope === "frames") {
    return products.filter(
      (p) =>
        p.category === "Frames" || p.category === "Prescription Glasses",
    );
  }
  return products;
}

export function buildPromoSlides(
  promotions: Promotion[],
  products: Product[],
): PromoSlideData[] {
  const activePromos = promotions
    .filter((p) => isPromotionActive(p.startDate, p.endDate, p.active))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.startDate.localeCompare(b.startDate);
    });

  const activeProducts = products
    .filter((p) => p.status === "active")
    .sort((a, b) => {
      const af = a.featured ? 0 : 1;
      const bf = b.featured ? 0 : 1;
      if (af !== bf) return af - bf;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return activePromos.map((promo) => ({
    promotion: promo,
    products: productsForPromotion(promo, activeProducts),
  }));
}
