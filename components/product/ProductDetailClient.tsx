"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import RelatedProductsCarousel from "@/components/product/RelatedProductsCarousel";
import ProductBackButton from "@/components/navigation/ProductBackButton";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import {
  cachedJsonFetch,
  peekPublicCache,
  productSlugCacheKey,
} from "@/lib/public-data-cache";
import type { Product } from "@/lib/types";

type ProductPayload = {
  product: Product | null;
  related: Product[];
  settings?: {
    whatsapp?: string;
    currencySymbol?: string;
    currency?: string;
  };
};

function ProductSkeleton() {
  return (
    <div className="product-page" aria-busy="true">
      <div className="product-page-inner wrap">
        <div className="product-topbar">
          <ProductBackButton />
        </div>
        <div className="product-layout">
          <div className="product-gallery">
            <div className="product-image-frame product-skeleton-block" />
          </div>
          <div className="product-info">
            <span className="product-skeleton-line" style={{ width: "30%" }} />
            <span className="product-skeleton-line" style={{ width: "70%", height: "1.6rem" }} />
            <span className="product-skeleton-line" style={{ width: "40%" }} />
            <span className="product-skeleton-line" style={{ width: "25%", height: "1.4rem" }} />
            <span className="product-skeleton-line" style={{ width: "100%", height: "4rem" }} />
            <span className="product-skeleton-line" style={{ width: "55%" }} />
            <span className="product-skeleton-line" style={{ width: "45%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const { t, dict } = useLocale();
  const cacheKey = productSlugCacheKey(slug);
  const cached = peekPublicCache<ProductPayload>(cacheKey);
  const [payload, setPayload] = useState<ProductPayload | null>(cached);
  const [loading, setLoading] = useState(!cached?.product);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hit = peekPublicCache<ProductPayload>(cacheKey);
    if (hit?.product) {
      setPayload(hit);
      setLoading(false);
    } else {
      setLoading(true);
    }

    cachedJsonFetch<ProductPayload>(
      cacheKey,
      `/api/products?slug=${encodeURIComponent(slug)}`,
      { ttlMs: 60_000 },
    )
      .then((data) => {
        if (cancelled) return;
        if (
          !data.product ||
          data.product.status === "archived" ||
          data.product.status === "draft"
        ) {
          setMissing(true);
          setPayload(null);
          return;
        }
        setPayload(data);
        setMissing(false);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, slug]);

  if (loading && !payload?.product) {
    return <ProductSkeleton />;
  }

  if (missing || !payload?.product) {
    return (
      <div className="product-page">
        <div className="product-page-inner wrap">
          <div className="product-topbar">
            <ProductBackButton />
          </div>
          <p className="frames-empty">{t("shop.empty")}</p>
          <Link href="/shop" className="btn btn-copper">
            {t("product.shop")}
          </Link>
        </div>
      </div>
    );
  }

  const product = payload.product;
  const related = payload.related || [];
  const settings = payload.settings;
  const whatsapp = settings?.whatsapp || "9725550180";
  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Hello Oyon, I'm interested in ${product.name} (${product.sku}).`,
  )}`;

  const images =
    product.images.length > 0
      ? product.images
      : ["/images/placeholder-frame.svg"];

  const availabilityLabel =
    product.status === "out_of_stock"
      ? t("product.outOfStock")
      : product.stockQuantity > 0
        ? t("product.inStore")
        : t("product.availability");

  const categoryLabel =
    dict.shop.categories[product.category as keyof typeof dict.shop.categories] ||
    product.category;

  const description =
    dict.product.descriptions[product.slug] || product.description;

  const isSunglasses = product.category === "Sunglasses";
  const isContactLenses = product.category === "Contact Lenses";
  const frameLabel = product.frameType
    ? dict.product.attrs[product.frameType] || product.frameType
    : null;
  const lensLabel = product.lensType
    ? dict.product.attrs[product.lensType] || product.lensType
    : null;
  const replacementLabel = product.replacementSchedule
    ? dict.product.attrs[product.replacementSchedule] ||
      product.replacementSchedule
    : null;
  const polarized =
    product.lensType?.toLowerCase().includes("polarized") ?? false;
  const uvProtection =
    product.lensType?.toLowerCase().includes("uv") ?? false;

  return (
    <div className="product-page">
      <div className="product-page-inner wrap">
        <div className="product-topbar">
          <ProductBackButton />
          <nav className="product-breadcrumb" aria-label="Breadcrumb">
            <Link href="/shop">{t("product.shop")}</Link>
            <span aria-hidden>/</span>
            <span>{categoryLabel}</span>
          </nav>
        </div>

        <div className="product-layout">
          <div className="product-gallery">
            <div
              className={`product-image-frame${
                isContactLenses ? " product-image-frame--contain-pack" : ""
              }`}
            >
              <Image
                src={images[0]}
                alt={product.name}
                fill
                priority
                className="object-contain"
                sizes="(max-width: 1023px) 100vw, 520px"
                quality={75}
              />
            </div>
            {images.length > 1 ? (
              <div className="product-thumbs">
                {images.slice(1, 4).map((src) => (
                  <div key={src} className="product-thumb">
                    <Image
                      src={src}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="120px"
                      loading="lazy"
                      quality={65}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="product-info">
            <span className="product-brand">{product.brand}</span>
            <h1 className="product-name">{product.name}</h1>
            <p className="product-category">{categoryLabel}</p>
            <p className="product-price">
              {formatPrice(product.sellingPrice, {
                currencySymbol: settings?.currencySymbol || "₪",
              })}
            </p>
            {product.status === "out_of_stock" ? (
              <span className="product-stock-pill">
                {t("product.outOfStock")}
              </span>
            ) : null}
            <p className="product-description">{description}</p>

            <dl className="product-meta">
              {frameLabel && !isContactLenses ? (
                <div>
                  <dt>
                    {isSunglasses
                      ? t("product.frameShape")
                      : t("product.frame")}
                  </dt>
                  <dd>{frameLabel}</dd>
                </div>
              ) : null}
              {lensLabel ? (
                <div>
                  <dt>
                    {isSunglasses || isContactLenses
                      ? t("product.lensType")
                      : t("product.lens")}
                  </dt>
                  <dd>{lensLabel}</dd>
                </div>
              ) : null}
              {isContactLenses && replacementLabel ? (
                <div>
                  <dt>{t("product.replacementSchedule")}</dt>
                  <dd>{replacementLabel}</dd>
                </div>
              ) : null}
              {isContactLenses && product.packageQuantity ? (
                <div>
                  <dt>{t("product.quantity")}</dt>
                  <dd>
                    {product.packageQuantity} {t("product.lensesUnit")}
                  </dd>
                </div>
              ) : null}
              {isSunglasses && polarized ? (
                <div>
                  <dt>{t("product.polarized")}</dt>
                  <dd>{dict.product.attrs.Polarized || "Polarized"}</dd>
                </div>
              ) : null}
              {isSunglasses && uvProtection ? (
                <div>
                  <dt>{t("product.uvProtection")}</dt>
                  <dd>{dict.product.attrs.UV400 || "UV400"}</dd>
                </div>
              ) : null}
              <div>
                <dt>{t("product.sku")}</dt>
                <dd>{product.sku}</dd>
              </div>
              <div>
                <dt>{t("product.availability")}</dt>
                <dd>{availabilityLabel}</dd>
              </div>
            </dl>

            <div className="product-actions">
              {isContactLenses ? (
                <Link
                  href="/book?type=contact_lens_fitting"
                  className="btn btn-copper product-btn"
                  prefetch
                >
                  {t("product.bookContactLensFitting")}
                </Link>
              ) : isSunglasses ? (
                <Link
                  href="/book?type=sunglasses_consultation"
                  className="btn btn-copper product-btn"
                  prefetch
                >
                  {t("product.bookConsultation")}
                </Link>
              ) : (
                <Link
                  href="/book?type=frame_consultation"
                  className="btn btn-copper product-btn"
                  prefetch
                >
                  {t("product.bookConsultation")}
                </Link>
              )}
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn product-btn product-btn-secondary"
              >
                {t("product.whatsapp")}
              </a>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <RelatedProductsCarousel
            products={related}
            currencySymbol={settings?.currencySymbol}
            relatedTitle={
              isContactLenses
                ? t("product.relatedContactLenses")
                : isSunglasses
                  ? t("product.relatedSunglasses")
                  : t("product.related")
            }
          />
        ) : null}
      </div>
    </div>
  );
}
