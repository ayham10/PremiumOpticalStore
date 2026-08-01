"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import PageAtmosphere from "@/components/PageAtmosphere";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Product, ProductCategory } from "@/lib/types";

const CATEGORIES: Array<ProductCategory | "All"> = [
  "All",
  "Prescription Glasses",
  "Sunglasses",
  "Contact Lenses",
  "Frames",
  "Accessories",
  "Cleaning Products",
];

function ShopContent() {
  const { t, dict } = useLocale();
  const searchParams = useSearchParams();

  const initialCategory = useMemo(() => {
    const raw = searchParams.get("category");
    if (!raw) return "All" as const;
    const decoded = decodeURIComponent(raw);
    return CATEGORIES.includes(decoded as ProductCategory | "All")
      ? (decoded as ProductCategory | "All")
      : ("All" as const);
  }, [searchParams]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ProductCategory | "All">(initialCategory);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

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
    return products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return [p.name, p.brand, p.description, p.category, p.sku]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [products, category, query]);

  function categoryLabel(cat: ProductCategory | "All") {
    if (cat === "All") return t("shop.all");
    return (
      dict.shop.categories[cat as keyof typeof dict.shop.categories] || cat
    );
  }

  return (
    <div className="pb-20">
      <PageAtmosphere
        eyebrow={t("shop.eyebrow")}
        title={t("shop.title")}
        lead={t("shop.lead")}
        image="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1800&q=80"
        video="/videos/hero.mp4"
      />
      <section className="wrap relative z-10">
        <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                  category === cat
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white shadow-[var(--shadow-soft)]"
                    : "border-[var(--line-strong)] bg-white/80 text-[var(--slate)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">{t("shop.search")}</span>
            <input
              className="input"
              placeholder={t("shop.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-[var(--radius)] bg-[var(--mist)]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-16 text-[var(--slate)]">{t("shop.empty")}</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product, i) => (
              <Reveal key={product.id} delay={(i % 6) * 60}>
                <ProductCard product={product} />
              </Reveal>
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
