import { isPromotionActive } from "@/lib/appointments";
import { SEED_PROMOTION_IDS } from "@/lib/seed";
import type { Product, Promotion } from "@/lib/types";

export type PromoSlideData = {
  promotion: Promotion;
  products: Product[];
};

const SEED_IDS = new Set<string>(SEED_PROMOTION_IDS);

/**
 * Admin-managed promotions for the public site.
 * Seed demo offers are omitted once any real Admin promotion exists.
 */
export function publicPromotions(promotions: Promotion[]): Promotion[] {
  const list = Array.isArray(promotions) ? promotions : [];
  const hasAdminPromo = list.some((p) => !SEED_IDS.has(p.id));
  const source = hasAdminPromo
    ? list.filter((p) => !SEED_IDS.has(p.id))
    : list;

  return source
    .filter((p) => isPromotionActive(p.startDate, p.endDate, p.active))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.startDate.localeCompare(b.startDate);
    });
}

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
  const activePromos = publicPromotions(promotions);

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
