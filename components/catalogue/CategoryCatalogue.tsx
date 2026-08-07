"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import Image from "next/image";
import { Heart, ArrowUpDown } from "lucide-react";
import {
  CatalogueFilterNav,
  type CatalogueFilterKey,
} from "@/components/catalogue/CatalogueFilters";
import SaveReturnLink from "@/components/navigation/SaveReturnLink";
import ScrollRestore from "@/components/navigation/ScrollRestore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import {
  cachedJsonFetch,
  peekPublicCache,
  productsCacheKey,
} from "@/lib/public-data-cache";
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
      <SaveReturnLink
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
          quality={70}
        />
      </SaveReturnLink>
      <div className="frames-product-body">
        <SaveReturnLink href={`/product/${product.slug}`} className="frames-product-name">
          {product.name}
        </SaveReturnLink>
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
      <span className="catalogue-sort-icon" aria-hidden>
        <ArrowUpDown size={13} strokeWidth={1.75} />
      </span>
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
  /** When set, continuously loop only the last N seconds of the hero video. */
  videoLoopTailSeconds?: number;
  /** Active category pill for shared catalogue navigation */
  activeFilter?: CatalogueFilterKey;
  bookHref?: string;
  bookLabel?: string;
  pageClass?: string;
};

export default function CategoryCatalogue({
  categories,
  title,
  lead,
  videoSrc,
  posterSrc,
  videoLoopTailSeconds,
  activeFilter = "All",
  pageClass = "",
}: CategoryCatalogueProps) {
  const { t } = useLocale();
  const cacheKey = productsCacheKey(categories);
  const cached = peekPublicCache<{ products: Product[] }>(cacheKey);
  const [products, setProducts] = useState<Product[]>(cached?.products || []);
  const [loading, setLoading] = useState(!cached);
  const [sort, setSort] = useState<CatalogueSort>("newest");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const categorySet = useMemo(() => new Set(categories), [cacheKey]);
  const useTailLoop =
    typeof videoLoopTailSeconds === "number" && videoLoopTailSeconds > 0;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const tailStart = () => {
      if (!useTailLoop || !Number.isFinite(video.duration) || video.duration <= 0) {
        return 0;
      }
      return Math.max(0, video.duration - videoLoopTailSeconds!);
    };

    const seekToTail = () => {
      const start = tailStart();
      if (start > 0 && Math.abs(video.currentTime - start) > 0.08) {
        try {
          video.currentTime = start;
        } catch {
          /* ignore seek errors before ready */
        }
      }
    };

    const onLoadedMeta = () => {
      if (cancelled) return;
      seekToTail();
      setHeroVideoReady(true);
      void video.play().catch(() => {
        /* autoplay can be blocked; poster remains */
      });
    };

    const onTimeUpdate = () => {
      if (!useTailLoop || cancelled) return;
      const start = tailStart();
      if (start <= 0) return;
      // Keep playback inside the final N seconds
      if (video.currentTime < start) {
        video.currentTime = start;
        return;
      }
      if (video.duration && video.currentTime >= video.duration - 0.05) {
        video.currentTime = start;
      }
    };

    const onEnded = () => {
      if (!useTailLoop || cancelled) return;
      seekToTail();
      void video.play().catch(() => undefined);
    };

    video.addEventListener("loadedmetadata", onLoadedMeta);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);

    const start = () => {
      if (cancelled) return;
      try {
        video.load();
        if (video.readyState >= 1) onLoadedMeta();
        else {
          void video.play().catch(() => {
            /* wait for metadata */
          });
        }
      } catch {
        /* ignore */
      }
    };

    const idleId =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(start, { timeout: 1500 })
        : null;
    const timeoutId = window.setTimeout(start, 350);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      window.clearTimeout(timeoutId);
    };
  }, [reduceMotion, videoSrc, useTailLoop, videoLoopTailSeconds]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    for (const category of categories) {
      params.append("category", category);
    }
    const url = `/api/products?${params.toString()}`;

    (async () => {
      try {
        const data = await cachedJsonFetch<{ products: Product[] }>(
          cacheKey,
          url,
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
  }, [cacheKey]);

  const items = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        (p.status === "active" || p.status === "out_of_stock") &&
        categorySet.has(p.category),
    );
    return sortProducts(filtered, sort);
  }, [products, categorySet, sort]);

  return (
    <div className={`frames-page catalogue-page${pageClass ? ` ${pageClass}` : ""}`}>
      <ScrollRestore />
      <section className="frames-hero" aria-label={title}>
        {reduceMotion ? (
          <Image
            src={posterSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            quality={75}
          />
        ) : (
          <>
            {/* Poster paints immediately; video loads after idle so it never blocks LCP */}
            {!heroVideoReady ? (
              <Image
                src={posterSrc}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
                quality={75}
              />
            ) : null}
            <video
              ref={videoRef}
              className="frames-hero-video"
              autoPlay
              muted
              loop={!useTailLoop}
              playsInline
              preload="none"
              poster={posterSrc}
              onLoadedData={() => setHeroVideoReady(true)}
              style={heroVideoReady ? undefined : { opacity: 0 }}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>
          </>
        )}
        <span className="frames-hero-veil" aria-hidden />
        <div className="catalogue-hero-copy">
          <h1 className="catalogue-hero-title">{title}</h1>
          <p className="catalogue-hero-lead">{lead}</p>
        </div>
      </section>

      <section className="frames-catalogue wrap">
        <div className="store-toolbar">
          <CatalogueFilterNav active={activeFilter} />
          <div className="catalogue-toolbar">
            <CatalogueSortSelect value={sort} onChange={setSort} />
          </div>
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
