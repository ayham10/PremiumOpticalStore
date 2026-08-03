"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  CatalogueProductCard,
  CatalogueSortSelect,
  sortProducts,
  type CatalogueSort,
} from "@/components/catalogue/CategoryCatalogue";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Product, ProductCategory } from "@/lib/types";

type StoreFilter =
  | "All"
  | "Prescription Frames"
  | "Sunglasses"
  | "Contact Lenses"
  | "Accessories";

const FILTERS: StoreFilter[] = [
  "All",
  "Prescription Frames",
  "Sunglasses",
  "Contact Lenses",
  "Accessories",
];

const FILTER_CATEGORIES: Record<Exclude<StoreFilter, "All">, ProductCategory[]> = {
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
    if (!raw) return "All" as StoreFilter;
    const decoded = decodeURIComponent(raw);
    if (decoded === "Frames" || decoded === "Prescription Glasses") {
      return "Prescription Frames";
    }
    if ((FILTERS as string[]).includes(decoded)) {
      return decoded as StoreFilter;
    }
    return "All";
  }, [searchParams]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StoreFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogueSort>("newest");

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (p.status !== "active") return false;
      if (filter !== "All") {
        const allowed = FILTER_CATEGORIES[filter];
        if (!allowed.includes(p.category)) return false;
      }
      if (!q) return true;
      return [p.name, p.brand, p.sku]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
    return sortProducts(list, sort);
  }, [products, filter, query, sort]);

  function filterLabel(f: StoreFilter) {
    if (f === "All") return t("shop.all");
    if (f === "Prescription Frames") return t("shop.filterFrames");
    if (f === "Sunglasses") return t("shop.categories.Sunglasses");
    if (f === "Contact Lenses") return t("shop.categories.Contact Lenses");
    return t("shop.categories.Accessories");
  }

  return (
    <div className="frames-page catalogue-page store-page">
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
          <div className="store-filters" role="tablist" aria-label={t("shop.title")}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`store-filter-chip${filter === f ? " is-active" : ""}`}
              >
                {filterLabel(f)}
              </button>
            ))}
          </div>

          <div className="store-toolbar-row">
            <label className="store-search">
              <Search size={15} className="store-search-icon" aria-hidden />
              <span className="sr-only">{t("shop.search")}</span>
              <input
                className="store-search-input"
                placeholder={t("shop.search")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
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
