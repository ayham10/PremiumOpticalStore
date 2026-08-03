"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product, ProductCategory } from "@/lib/types";

export type CatalogueSort = "newest" | "price-asc" | "price-desc";

export function sortProducts(items: Product[], sort: CatalogueSort): Product[] {
  const next = [...items];
  if (sort === "price-asc") {
    next.sort((a, b) => a.sellingPrice - b.sellingPrice);
  } else if (sort === "price-desc") {
    next.sort((a, b) => b.sellingPrice - a.sellingPrice);
  } else {
    next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return next;
}

export function CatalogueProductCard({ product }: { product: Product }) {
  const { t } = useLocale();
  const image = product.images[0] || "/images/placeholder-frame.svg";
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("oyon-wishlist");
      const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      setSaved(ids.includes(product.id));
    } catch {
      /* ignore */
    }
  }, [product.id]);

  function toggleWish(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = localStorage.getItem("oyon-wishlist");
      const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const next = saved
        ? ids.filter((id) => id !== product.id)
        : [...ids, product.id];
      localStorage.setItem("oyon-wishlist", JSON.stringify(next));
      setSaved(!saved);
    } catch {
      setSaved((v) => !v);
    }
  }

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
          sizes="(max-width: 639px) 33vw, (max-width: 1023px) 33vw, 25vw"
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
          <button
            type="button"
            className={`frames-product-wish${saved ? " is-active" : ""}`}
            aria-label={t("shop.wishlist")}
            aria-pressed={saved}
            onClick={toggleWish}
          >
            <Heart size={15} strokeWidth={1.6} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function CatalogueSortSelect({
  value,
  onChange,
}: {
  value: CatalogueSort;
  onChange: (value: CatalogueSort) => void;
}) {
  const { t } = useLocale();
  return (
    <label className="catalogue-sort">
      <span className="sr-only">{t("shop.sortLabel")}</span>
      <select
        className="catalogue-sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as CatalogueSort)}
      >
        <option value="newest">{t("shop.sortNewest")}</option>
        <option value="price-asc">{t("shop.sortPriceAsc")}</option>
        <option value="price-desc">{t("shop.sortPriceDesc")}</option>
      </select>
    </label>
  );
}

export type CategoryCatalogueProps = {
  categories: ProductCategory[];
  title: string;
  lead: string;
  videoSrc: string;
  posterSrc: string;
  bookHref?: string;
  bookLabel?: string;
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
  const [sort, setSort] = useState<CatalogueSort>("newest");
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

  const items = useMemo(() => {
    const filtered = products.filter(
      (p) => p.status === "active" && categorySet.has(p.category),
    );
    return sortProducts(filtered, sort);
  }, [products, categorySet, sort]);

  return (
    <div className="frames-page catalogue-page">
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
        <div className="catalogue-hero-copy">
          <h1 className="catalogue-hero-title">{title}</h1>
          <p className="catalogue-hero-lead">{lead}</p>
        </div>
      </section>

      <section className="frames-catalogue wrap">
        <div className="catalogue-toolbar">
          <CatalogueSortSelect value={sort} onChange={setSort} />
        </div>

        {loading ? (
          <div className="frames-product-grid" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
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
