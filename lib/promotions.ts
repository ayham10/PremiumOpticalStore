import { isPromotionActive } from "@/lib/appointments";
import { SEED_PROMOTION_IDS, SEED_PROMOTIONS } from "@/lib/seed";
import type { Product, Promotion } from "@/lib/types";

export type PromoSlideData = {
  promotion: Promotion;
  products: Product[];
};

const SEED_DEMO_IDS = new Set<string>(SEED_PROMOTION_IDS);
const SEED_DEMO_COUPONS = new Set(
  SEED_PROMOTIONS.map((p) => (p.couponCode || "").trim().toUpperCase()).filter(
    Boolean,
  ),
);

function norm(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * First-run catalogue demos from lib/seed.ts. Match by id, coupon, or the
 * original title/discount pair — persisted copies may not still use promo-1/2.
 */
export function isSeedDemoPromotion(promo: Promotion): boolean {
  const id = (promo.id || "").trim();
  if (SEED_DEMO_IDS.has(id)) return true;

  const coupon = (promo.couponCode || "").trim().toUpperCase();
  if (coupon && SEED_DEMO_COUPONS.has(coupon)) return true;

  const title = norm(promo.title);
  const discount = norm(promo.discount);
  if (SEED_PROMOTIONS.some((seed) => {
    const seedTitle = norm(seed.title);
    const seedDiscount = norm(seed.discount);
    return Boolean(seedTitle) && title === seedTitle && discount === seedDiscount;
  })) {
    return true;
  }

  if (
    title.includes("complimentary lens upgrade") &&
    (discount.includes("ar coating") || discount.includes("free ar"))
  ) {
    return true;
  }
  if (
    title.includes("second pair") &&
    (discount.includes("50%") || title.includes("half price"))
  ) {
    return true;
  }
  return false;
}

/**
 * Public catalogue offers = Admin promotions that are active and in date.
 * Built-in seed demos are never published.
 */
export function publicPromotions(promotions: Promotion[]): Promotion[] {
  const list = Array.isArray(promotions) ? promotions : [];
  return list
    .filter((p) => !isSeedDemoPromotion(p))
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
