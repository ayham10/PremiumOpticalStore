"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product, ProductCategory } from "@/lib/types";

function CatalogueProductCard({ product }: { product: Product }) {
  const { t } = useLocale();
  const image = product.images[0] || "/images/placeholder-frame.svg";

  return (
    <article className="frames-product-card">
      <Link
        href={`/product/${product.slug}`}
        className="frames-product-media"
        aria-label={product.name}
      >
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
          className="object-cover"
          loading="lazy"
        />
      </Link>
      <div className="frames-product-body">
        <Link href={`/product/${product.slug}`} className="frames-product-name">
          {product.name}
        </Link>
        <div className="frames-product-meta">
          <strong className="frames-product-price">
            {formatPrice(product.sellingPrice)}
          </strong>
          <Link href={`/product/${product.slug}`} className="frames-product-view">
            {t("shop.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}

export type CategoryCatalogueProps = {
  categories: ProductCategory[];
  title: string;
  lead: string;
  videoSrc: string;
  posterSrc: string;
};

export default function CategoryCatalogue({
  categories,
  title,
  lead,
  videoSrc,
  posterSrc,
}: CategoryCatalogueProps) {
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const categorySet = useMemo(() => new Set(categories), [categories]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/products");
        const data = (await res.json()) as { products: Product[] };
        if (!cancelled) setProducts(data.products || []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      products.filter(
        (p) => p.status === "active" && categorySet.has(p.category),
      ),
    [products, categorySet],
  );

  return (
    <div className="frames-page">
      <section className="frames-hero" aria-label={title}>
        {reduceMotion ? (
          <Image
            src={posterSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <video
            className="frames-hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={posterSrc}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
        <span className="frames-hero-veil" aria-hidden />
      </section>

      <section className="frames-catalogue wrap">
        <header className="frames-catalogue-head">
          <h1 className="frames-catalogue-title">{title}</h1>
          <p className="frames-catalogue-lead">{lead}</p>
        </header>

        {loading ? (
          <div className="frames-product-grid" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="frames-product-skeleton" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="frames-empty">{t("shop.empty")}</p>
        ) : (
          <div className="frames-product-grid">
            {items.map((product) => (
              <CatalogueProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
