"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useLocale } from "@/components/i18n/LocaleProvider";

export default function ProductCard({ product }: { product: Product }) {
  const { t, dict } = useLocale();
  const image = product.images[0] || "/images/placeholder-frame.svg";
  const categoryLabel =
    dict.shop.categories[product.category as keyof typeof dict.shop.categories] ||
    product.category;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow)]">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-[var(--mist)]"
      >
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <span className="absolute start-3 top-3 pill bg-white/90">{categoryLabel}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
          {product.brand}
        </div>
        <Link
          href={`/product/${product.slug}`}
          className="font-[family-name:var(--font-display)] text-2xl"
        >
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-[var(--slate)]">{product.description}</p>
        <div className="mt-auto flex items-center justify-between pt-4">
          <strong className="text-lg">{formatPrice(product.sellingPrice)}</strong>
          <Link
            href={`/product/${product.slug}`}
            className="btn btn-ghost !min-h-10 !px-4 !text-sm"
          >
            {t("shop.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}
