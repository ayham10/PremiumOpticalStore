"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SaveReturnLink from "@/components/navigation/SaveReturnLink";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

type RelatedItem = Pick<
  Product,
  "id" | "slug" | "name" | "images" | "sellingPrice" | "category"
>;

export default function RelatedProductsCarousel({
  products,
  currencySymbol,
  relatedTitle,
}: {
  products: RelatedItem[];
  currencySymbol?: string;
  relatedTitle?: string;
}) {
  const { t, dict, rtl } = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);
  const heading =
    relatedTitle ||
    (products[0]?.category === "Sunglasses"
      ? t("product.relatedSunglasses")
      : products[0]?.category === "Contact Lenses"
        ? t("product.relatedContactLenses")
        : t("product.related"));

  const scrollByCard = useCallback(
    (direction: 1 | -1) => {
      const el = trackRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>(".product-related-card");
      const amount = (card?.offsetWidth || 240) + 16;
      const delta = direction * amount * (rtl ? -1 : 1);
      el.scrollBy({ left: delta, behavior: "smooth" });
    },
    [rtl],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollByCard(rtl ? -1 : 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByCard(rtl ? 1 : -1);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [rtl, scrollByCard]);

  if (products.length === 0) return null;

  return (
    <section className="product-related" aria-labelledby="related-heading">
      <div className="product-related-header">
        <div>
          <span className="product-related-eyebrow">{heading}</span>
          <h2 id="related-heading" className="product-related-title">
            {heading}
          </h2>
        </div>
        <div className="product-related-controls">
          <button
            type="button"
            className="product-related-nav"
            aria-label={t("product.previous")}
            onClick={() => scrollByCard(-1)}
          >
            {rtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            type="button"
            className="product-related-nav"
            aria-label={t("product.next")}
            onClick={() => scrollByCard(1)}
          >
            {rtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="product-related-track"
        tabIndex={0}
        role="region"
        aria-label={heading}
      >
        {products.map((product) => {
          const image = product.images[0] || "/images/placeholder-frame.svg";
          const categoryLabel =
            dict.shop.categories[
              product.category as keyof typeof dict.shop.categories
            ] || product.category;

          return (
            <article key={product.id} className="product-related-card">
              <SaveReturnLink
                href={`/product/${product.slug}`}
                className="product-related-media"
                aria-label={product.name}
              >
                <Image
                  src={image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 767px) 70vw, 260px"
                  className="object-cover"
                  loading="lazy"
                  quality={70}
                />
              </SaveReturnLink>
              <div className="product-related-body">
                <span className="product-related-cat">{categoryLabel}</span>
                <SaveReturnLink
                  href={`/product/${product.slug}`}
                  className="product-related-name"
                >
                  {product.name}
                </SaveReturnLink>
                <strong className="product-related-price">
                  {formatPrice(product.sellingPrice, {
                    currencySymbol: currencySymbol || "₪",
                  })}
                </strong>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
