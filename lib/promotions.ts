import { isPromotionActive } from "@/lib/appointments";
import { withProductLocale } from "@/lib/product-i18n";
import { storefrontProductImages } from "@/lib/product-images";
import { computeDiscountedPrice } from "@/lib/promo-price";
import { SEED_PROMOTION_IDS, SEED_PROMOTIONS } from "@/lib/seed";
import type { CategoryDefaultImages, Product, Promotion } from "@/lib/types";

export { computeDiscountedPrice } from "@/lib/promo-price";

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

export function productMatchesPromotion(
  product: Product,
  promo: Promotion,
): boolean {
  return productsForPromotion(promo, [product]).length > 0;
}

/** First matching public promotion by existing priority, then start date. Does not stack. */
export function bestPromotionForProduct(
  product: Product,
  promotions: Promotion[],
): Promotion | null {
  if (product.status === "archived" || product.status === "draft") return null;
  for (const promo of publicPromotions(promotions)) {
    if (productMatchesPromotion(product, promo)) return promo;
  }
  return null;
}

export function productDiscountedPrice(
  product: Pick<Product, "sellingPrice" | "status" | "category" | "id">,
  promotions: Promotion[],
): number | undefined {
  const promo = bestPromotionForProduct(product as Product, promotions);
  if (!promo) return undefined;
  const next = computeDiscountedPrice(product.sellingPrice, promo);
  if (next >= product.sellingPrice) return undefined;
  return next;
}

export function buildPromoSlides(
  promotions: Promotion[],
  products: Product[],
  defaults?: CategoryDefaultImages | null,
  locale?: string,
): PromoSlideData[] {
  const activePromos = publicPromotions(promotions);

  const activeProducts = products
    .filter((p) => p.status === "active")
    .map((p) => {
      const localized = withProductLocale(p, locale);
      const { locales: _locales, i18nSource: _source, ...rest } = localized;
      return {
        ...rest,
        images: storefrontProductImages(p, defaults),
      };
    })
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
