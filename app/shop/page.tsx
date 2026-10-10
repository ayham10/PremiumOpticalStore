"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CatalogueProductCard,
  CatalogueSortSelect,
  sortProducts,
  type CatalogueSort,
} from "@/components/catalogue/CategoryCatalogue";
import StoreCatalogHero from "@/components/shop/StoreCatalogHero";
import { CataloguePagedList } from "@/components/catalogue/CataloguePagination";
import { DynamicCatalogueFilterChips } from "@/components/catalogue/CatalogueFilters";
import ScrollRestore from "@/components/navigation/ScrollRestore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cachedJsonFetch, productsCacheKey } from "@/lib/public-data-cache";
import {
  productBelongsToCategory,
  productVisibleInMainCatalog,
} from "@/lib/catalog-categories";
import type { CatalogCategory, CategoryDefaultImages, Product } from "@/lib/types";
import { rememberCategoryDefaultImages } from "@/lib/use-category-default-images";

type PublicCategory = { id: string; name: string; showInMainCatalog?: boolean };

function ShopContent() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();

  const requested = useMemo(() => {
    const raw = searchParams.get("category");
    if (!raw) return "all";
    const decoded = decodeURIComponent(raw);
    if (decoded === "All" || decoded === "Prescription Frames") return "all";
    return decoded;
  }, [searchParams]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(requested);
  const [sort, setSort] = useState<CatalogueSort>("newest");

  useEffect(() => {
    setFilter(requested);
  }, [requested]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await cachedJsonFetch<{
          products: Product[];
          categoryDefaultImages?: CategoryDefaultImages;
          catalogCategories?: PublicCategory[];
        }>(
          productsCacheKey(["__all__", locale]),
          `/api/products?locale=${encodeURIComponent(locale)}`,
          { ttlMs: 60_000 },
        );
        rememberCategoryDefaultImages(data.categoryDefaultImages);
        if (!cancelled) {
          setProducts(data.products || []);
          setCategories(data.catalogCategories || []);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const visibleCategories = useMemo(
    () => categories.filter((item) => item.id && item.name),
    [categories],
  );

  const activeFilter = useMemo(() => {
    if (filter === "all") return "all";
    return visibleCategories.some((item) => item.id === filter) ? filter : "all";
  }, [filter, visibleCategories]);

  const filtered = useMemo(() => {
    const catalog = visibleCategories.map(
      (item) =>
        ({
          id: item.id,
          names: { ar: item.name, he: item.name, en: item.name },
          showInMainCatalog: true,
          createdAt: "",
          updatedAt: "",
        }) satisfies CatalogCategory,
    );
    const seen = new Set<string>();
    const list = products.filter((product) => {
      if (product.status !== "active") return false;
      if (seen.has(product.id)) return false;
      const visible =
        activeFilter === "all"
          ? productVisibleInMainCatalog(product, catalog) ||
            (product.categoryIds || []).some((id) =>
              visibleCategories.some((item) => item.id === id),
            ) ||
            visibleCategories.some((item) => item.id === product.category)
          : productBelongsToCategory(product, activeFilter);
      if (!visible) return false;
      seen.add(product.id);
      return true;
    });
    return sortProducts(list, sort);
  }, [products, sort, activeFilter, visibleCategories]);

  return (
    <div className="frames-page catalogue-page store-page">
      <ScrollRestore />
      <StoreCatalogHero />

      <section className="frames-catalogue wrap">
        <div className="store-toolbar">
          <DynamicCatalogueFilterChips
            categories={visibleCategories}
            active={activeFilter}
            onChange={setFilter}
            allLabel={t("shop.all")}
          />
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
          <CataloguePagedList
            items={filtered}
            resetKey={`${activeFilter}:${sort}`}
            renderItem={(product) => <CatalogueProductCard product={product} />}
          />
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
