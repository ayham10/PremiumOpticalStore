"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, CalendarCheck2 } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice, productPublicKey } from "@/lib/format";
import { cachedJsonFetch, productsCacheKey } from "@/lib/public-data-cache";
import type { CategoryDefaultImages, Product } from "@/lib/types";
import { CataloguePagedList } from "@/components/catalogue/CataloguePagination";
import { productDisplayImage } from "@/lib/product-images";
import {
  CONTACT_LENSES_DEFAULT_FEATURE_ICONS,
  resolveServiceFeatureIcon,
} from "@/lib/service-page-icons";
import {
  pickServiceFeatures,
  pickServiceText,
} from "@/lib/service-pages";
import { useLocalizedServicePages } from "@/lib/use-service-pages";
import {
  rememberCategoryDefaultImages,
  useCategoryDefaultImages,
} from "@/lib/use-category-default-images";

function ContactLensCard({ product }: { product: Product }) {
  const { t, dict } = useLocale();
  const defaults = useCategoryDefaultImages();
  const href = `/product/${productPublicKey(product)}`;
  const image = productDisplayImage(product, defaults);
  const typeLabel = product.lensType
    ? dict.product.attrs[product.lensType] || product.lensType
    : null;

  return (
    <article className="frames-product-card cl-product-card">
      <Link
        href={href}
        className="frames-product-media cl-product-media"
        aria-label={product.name}
      >
        <Image
          src={image}
          alt={product.name}
          fill
          sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
          className="object-contain"
          loading="lazy"
        />
      </Link>
      <div className="frames-product-body">
        {typeLabel ? <span className="cl-product-type">{typeLabel}</span> : null}
        <Link href={href} className="frames-product-name">
          {product.name}
        </Link>
        <div className="frames-product-meta">
          <strong className="frames-product-price">
            {formatPrice(product.sellingPrice)}
          </strong>
          <Link href={href} className="frames-product-view">
            {t("shop.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}

const FEATURES = [
  {
    key: "fitting",
    titleKey: "contactLenses.info.fittingTitle",
    textKey: "contactLenses.info.fittingText",
  },
  {
    key: "options",
    titleKey: "contactLenses.info.optionsTitle",
    textKey: "contactLenses.info.optionsText",
  },
  {
    key: "support",
    titleKey: "contactLenses.info.supportTitle",
    textKey: "contactLenses.info.supportText",
  },
  {
    key: "safety",
    titleKey: "contactLenses.info.safetyTitle",
    textKey: "contactLenses.info.safetyText",
  },
] as const;

export default function ContactLensesPage() {
  const { t, rtl } = useLocale();
  const saved = useLocalizedServicePages()?.contactLenses;
  const title = pickServiceText(saved?.title, t("contactLenses.title"));
  const features = pickServiceFeatures(
    saved?.features,
    FEATURES.map(({ titleKey, textKey }) => ({
      title: t(titleKey),
      description: t(textKey),
    })),
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

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
        const data = await cachedJsonFetch<{
          products: Product[];
          categoryDefaultImages?: CategoryDefaultImages;
        }>(
          productsCacheKey(["Contact Lenses"]),
          "/api/products?category=Contact%20Lenses",
          { ttlMs: 60_000 },
        );
        rememberCategoryDefaultImages(data.categoryDefaultImages);
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
    () => products.filter((p) => p.status === "active"),
    [products],
  );

  return (
    <div className="frames-page cl-page" dir={rtl ? "rtl" : "ltr"}>
      <section className="cl-hero" aria-label={title}>
        <div className="cl-hero-media">
          {reduceMotion ? (
            <Image
              src="/images/contact-lenses-hero-poster.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <video
              className="cl-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/images/contact-lenses-hero-poster.jpg"
            >
              <source src="/videos/contact-lenses-hero.mp4" type="video/mp4" />
            </video>
          )}
        </div>
        <span className="cl-hero-veil" aria-hidden />
        <div className="cl-hero-copy">
          <p className="cl-eyebrow">
            {pickServiceText(saved?.eyebrow, t("contactLenses.eyebrow"))}
          </p>
          <h1 className="cl-title">{title}</h1>
          <p className="cl-description">
            {pickServiceText(saved?.description, t("contactLenses.description"))}
          </p>
          <div className="cl-hero-actions">
            <Link
              href="/book?type=contact_lens_fitting"
              className="btn btn-copper cl-book-btn"
            >
              <CalendarCheck2 size={18} strokeWidth={1.8} aria-hidden />
              {pickServiceText(
                saved?.bookingButtonText,
                t("contactLenses.bookCta"),
              )}
            </Link>
          </div>
        </div>
      </section>

      <div className="cl-inner">
        <section className="cl-features" aria-label={t("contactLenses.info.aria")}>
          <div className="cl-features-grid">
            {FEATURES.map(({ key }, index) => {
              const Icon = resolveServiceFeatureIcon(
                features[index]?.icon,
                CONTACT_LENSES_DEFAULT_FEATURE_ICONS[index] ?? "shield-check",
              );
              return (
                <article key={key} className="cl-feature">
                  <span className="cl-feature-orb" aria-hidden>
                    <Icon size={18} strokeWidth={1.7} />
                  </span>
                  <div className="cl-feature-copy">
                    <h2 className="cl-feature-title">
                      {features[index]?.title}
                    </h2>
                    <p className="cl-feature-text">
                      {features[index]?.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="cl-safety" role="note">
          <AlertTriangle className="cl-safety-icon" size={18} strokeWidth={1.7} aria-hidden />
          <p>
            {pickServiceText(saved?.warningText, t("contactLenses.safety"))}
          </p>
        </aside>

        <section className="cl-catalogue-block" aria-labelledby="cl-catalogue-heading">
          <h2 id="cl-catalogue-heading" className="cl-catalogue-title">
            <span className="cl-catalogue-rule" aria-hidden />
            <span className="cl-catalogue-label">{t("contactLenses.catalogueTitle")}</span>
            <span className="cl-catalogue-rule" aria-hidden />
          </h2>
          {loading ? (
            <div className="frames-product-grid" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="frames-product-skeleton" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="frames-empty">{t("shop.empty")}</p>
          ) : (
            <CataloguePagedList
              items={items}
              resetKey="contact-lenses"
              gridClassName="frames-product-grid contact-lens-grid"
              renderItem={(product) => <ContactLensCard product={product} />}
            />
          )}
        </section>
      </div>
    </div>
  );
}
