"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice, productPublicKey } from "@/lib/format";
import { productDisplayImage } from "@/lib/product-images";
import { useCategoryDefaultImages } from "@/lib/use-category-default-images";
import type { Product } from "@/lib/types";

export type CustomPageProductCard = Pick<
  Product,
  "id" | "slug" | "name" | "images" | "sellingPrice" | "category" | "status"
>;

export default function CustomPageProductsCarousel({
  products,
  currencySymbol,
  dir,
}: {
  products: CustomPageProductCard[];
  currencySymbol?: string;
  dir?: "ltr" | "rtl";
}) {
  const { dict } = useLocale();
  const defaults = useCategoryDefaultImages();
  if (!products.length) return null;

  return (
    <section className="csp-products" aria-label={dict.shop?.title || "Products"}>
      <div className="csp-products-track" dir={dir}>
        {products.map((product) => {
          const href = `/product/${productPublicKey(product)}`;
          const image = productDisplayImage(product, defaults);
          const categoryLabel =
            dict.shop.categories[
              product.category as keyof typeof dict.shop.categories
            ] || product.category;
          return (
            <article key={product.id} className="csp-products-card">
              <Link href={href} className="csp-products-media" aria-label={product.name}>
                <Image
                  src={image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 767px) 145px, 18vw"
                  className="object-cover"
                  loading="lazy"
                  quality={70}
                />
              </Link>
              <div className="csp-products-body">
                <span className="csp-products-cat">{categoryLabel}</span>
                <Link href={href} className="csp-products-name">
                  {product.name}
                </Link>
                <strong className="csp-products-price">
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
