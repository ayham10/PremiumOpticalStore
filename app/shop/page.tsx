"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  CatalogueProductCard,
  CatalogueSortSelect,
  sortProducts,
  type CatalogueSort,
} from "@/components/catalogue/CategoryCatalogue";
import {
  CatalogueFilterChips,
  type CatalogueFilterKey,
} from "@/components/catalogue/CatalogueFilters";
import ScrollRestore from "@/components/navigation/ScrollRestore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cachedJsonFetch, productsCacheKey } from "@/lib/public-data-cache";
import type { Product, ProductCategory } from "@/lib/types";

const FILTER_CATEGORIES: Record<
  Exclude<CatalogueFilterKey, "All">,
  ProductCategory[]
> = {
  "Prescription Frames": ["Frames", "Prescription Glasses"],
  Sunglasses: ["Sunglasses"],
  "Contact Lenses": ["Contact Lenses"],
  Accessories: ["Accessories", "Cleaning Products"],
};

function ShopContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();

  const initialFilter = useMemo(() => {
    const raw = searchParams.get("category");
    if (!raw) return "All" as CatalogueFilterKey;
    const decoded = decodeURIComponent(raw);
    if (decoded === "Frames" || decoded === "Prescription Glasses") {
      return "Prescription Frames";
    }
    if (
      (
        [
          "All",
          "Prescription Frames",
          "Sunglasses",
          "Contact Lenses",
          "Accessories",
        ] as string[]
      ).includes(decoded)
    ) {
      return decoded as CatalogueFilterKey;
    }
    return "All";
  }, [searchParams]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CatalogueFilterKey>(initialFilter);
  const [sort, setSort] = useState<CatalogueSort>("newest");

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await cachedJsonFetch<{ products: Product[] }>(
          productsCacheKey(["__all__"]),
          "/api/products",
          { ttlMs: 60_000 },
        );
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

  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      if (p.status !== "active") return false;
      if (filter !== "All") {
        const allowed = FILTER_CATEGORIES[filter];
        if (!allowed.includes(p.category)) return false;
      }
      return true;
    });
    return sortProducts(list, sort);
  }, [products, filter, sort]);

  return (
    <div className="frames-page catalogue-page store-page">
      <ScrollRestore />
      <section className="frames-hero store-hero" aria-label={t("shop.title")}>
        <Image
          src="/images/store-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover store-hero-image"
        />
        <span className="frames-hero-veil store-hero-veil" aria-hidden />
        <div className="catalogue-hero-copy store-hero-copy">
          <h1 className="catalogue-hero-title">{t("shop.title")}</h1>
          <p className="catalogue-hero-lead">{t("shop.lead")}</p>
        </div>
      </section>

      <section className="frames-catalogue wrap">
        <div className="store-toolbar">
          <CatalogueFilterChips active={filter} onChange={setFilter} />
          <div className="catalogue-toolbar">
            <CatalogueSortSelect value={sort} onChange={setSort} />
          </div>
        </div>

        {loading ? (
          <div className="frames-product-grid" aria-hidden>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="frames-product-skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="frames-empty">{t("shop.empty")}</p>
        ) : (
          <div className="frames-product-grid">
            {filtered.map((product) => (
              <CatalogueProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ShopFallback() {
  const { t } = useLocale();
  return (
    <div className="wrap pb-20 pt-28 text-[var(--slate)]">{t("common.loading")}</div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopContent />
    </Suspense>
  );
}
