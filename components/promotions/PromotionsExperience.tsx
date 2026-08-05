"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Gift,
  Percent,
  ShieldCheck,
  Truck,
  BadgeCheck,
  RotateCcw,
} from "lucide-react";
import ScrollRestore from "@/components/navigation/ScrollRestore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product, Promotion } from "@/lib/types";

const FALLBACK_HERO = "/images/store-hero.jpg";
const AUTO_MS = 3500;

export type PromoSlide = {
  promotion: Promotion;
  products: Product[];
};

/** Compute discounted price from typed fields, with discount-string fallback. */
export function computeDiscountedPrice(
  sellingPrice: number,
  promo: Promotion
): number {
  const type = promo.discountType;
  const value = promo.discountValue;

  if (type === "percentage" && typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, sellingPrice * (1 - value / 100));
  }
  if (type === "fixed" && typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, sellingPrice - value);
  }

  const d = promo.discount || "";
  const pct = d.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    return Math.max(0, sellingPrice * (1 - parseFloat(pct[1]) / 100));
  }
  const fixed = d.match(/(?:₪|NIS|ILS)?\s*(\d+(?:\.\d+)?)/i);
  if (fixed) {
    return Math.max(0, sellingPrice - parseFloat(fixed[1]));
  }
  return sellingPrice;
}

function formatUntil(dateStr: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${dateStr}T12:00:00`));
  } catch {
    return dateStr;
  }
}

function promoIcon(discount: string) {
  if (/\d+\s*%/.test(discount) || discount.includes("%")) return "percent";
  return "gift";
}

function discountBadgeLabel(promo: Promotion): string {
  if (
    promo.discountType === "percentage" &&
    typeof promo.discountValue === "number"
  ) {
    return `-${promo.discountValue}%`;
  }
  if (
    promo.discountType === "fixed" &&
    typeof promo.discountValue === "number"
  ) {
    return `-${formatPrice(promo.discountValue)}`;
  }
  return promo.discount;
}

export default function PromotionsExperience({
  slides,
}: {
  slides: PromoSlide[];
}) {
  const { t, locale, rtl } = useLocale();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const multi = slides.length > 1;

  const goTo = useCallback(
    (next: number) => {
      if (!slides.length) return;
      const len = slides.length;
      setIndex(((next % len) + len) % len);
    },
    [slides.length]
  );

  const pause = useCallback(() => setPaused(true), []);

  useEffect(() => {
    if (!multi || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [multi, paused, slides.length]);

  function onTouchStart(e: ReactTouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    pause();
  }

  function onTouchEnd(e: ReactTouchEvent) {
    if (touchStartX.current == null || !multi) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    const forward = rtl ? delta > 0 : delta < 0;
    goTo(index + (forward ? 1 : -1));
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === "touch") return;
    touchStartX.current = e.clientX;
    pause();
  }

  function onPointerUp(e: ReactPointerEvent) {
    if (e.pointerType === "touch") return;
    if (touchStartX.current == null || !multi) return;
    const delta = e.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    const forward = rtl ? delta > 0 : delta < 0;
    goTo(index + (forward ? 1 : -1));
  }

  if (slides.length === 0) {
    return (
      <div className="promo-page">
        <ScrollRestore />
        <section className="promo-section wrap">
          <p className="promo-empty">{t("offersPage.empty")}</p>
        </section>
      </div>
    );
  }

  const current = slides[index];
  const promo = current.promotion;

  return (
    <div className="promo-page">
      <ScrollRestore />

      <section
        className="promo-carousel"
        aria-roledescription="carousel"
        aria-label={t("offersPage.activeOffers")}
        onMouseEnter={pause}
        onFocusCapture={pause}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div
          className="promo-carousel-track"
          style={{ transform: `translateX(${-index * 100}%)` }}
        >
          {slides.map((slide) => (
            <article
              key={slide.promotion.id}
              className="promo-carousel-slide"
              aria-roledescription="slide"
            >
              <div className="promo-slide-hero">
                <Image
                  src={slide.promotion.image || FALLBACK_HERO}
                  alt=""
                  fill
                  priority={slide.promotion.id === promo.id}
                  sizes="100vw"
                  className="object-cover promo-hero-image"
                />
                <span className="promo-hero-veil" aria-hidden />
                <div className="promo-hero-copy wrap">
                  <p className="promo-hero-eyebrow">
                    {t("offersPage.limitedTime")}
                  </p>
                  <h1 className="promo-hero-title">
                    {slide.promotion.discount || t("offersPage.title")}
                  </h1>
                  <p className="promo-hero-lead">
                    {slide.promotion.title || t("offersPage.lead")}
                  </p>
                  {slide.promotion.description ? (
                    <p className="promo-slide-desc">
                      {slide.promotion.description}
                    </p>
                  ) : null}
                  {slide.promotion.couponCode ? (
                    <p className="promo-slide-code">
                      {t("offersPage.code")}:{" "}
                      <strong>{slide.promotion.couponCode}</strong>
                    </p>
                  ) : null}
                  <p className="promo-card-until promo-slide-until">
                    <Calendar size={13} strokeWidth={1.7} aria-hidden />
                    <span>
                      {t("offersPage.until")}{" "}
                      {formatUntil(slide.promotion.endDate, locale)}
                    </span>
                  </p>
                  <Link href="/shop" className="promo-hero-cta">
                    <span>{t("offersPage.shopOffer")}</span>
                    <ArrowLeft
                      size={16}
                      strokeWidth={1.8}
                      className={rtl ? undefined : "promo-hero-cta-icon-ltr"}
                    />
                  </Link>
                </div>
              </div>

              {slide.products.length > 0 ? (
                <div className="promo-slide-products wrap">
                  <header className="promo-section-head">
                    <span className="promo-section-rule" aria-hidden />
                    <h2>{t("offersPage.offerProducts")}</h2>
                    <span className="promo-section-rule" aria-hidden />
                  </header>
                  <div className="promo-product-rail" role="list">
                    {slide.products.map((product) => (
                      <PromoProductCard
                        key={product.id}
                        product={product}
                        promo={slide.promotion}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>

        {multi ? (
          <div className="promo-carousel-dots" role="tablist">
            {slides.map((slide, i) => (
              <button
                key={slide.promotion.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.promotion.title}
                className={`promo-carousel-dot${i === index ? " is-active" : ""}`}
                onClick={() => {
                  pause();
                  goTo(i);
                }}
              />
            ))}
          </div>
        ) : null}
      </section>

      {slides.length > 1 ? (
        <section className="promo-section wrap">
          <header className="promo-section-head">
            <span className="promo-section-rule" aria-hidden />
            <h2>{t("offersPage.activeOffers")}</h2>
            <span className="promo-section-rule" aria-hidden />
          </header>
          <div className="promo-card-rail">
            {slides.map((slide, i) => {
              const icon = promoIcon(slide.promotion.discount);
              return (
                <button
                  key={slide.promotion.id}
                  type="button"
                  className={`promo-card${i === index ? " is-featured" : ""}`}
                  onClick={() => {
                    pause();
                    goTo(i);
                  }}
                >
                  <div className="promo-card-media">
                    <Image
                      src={slide.promotion.image || FALLBACK_HERO}
                      alt={slide.promotion.title}
                      fill
                      sizes="(max-width: 767px) 70vw, 280px"
                      className="object-cover"
                    />
                    <span className="promo-card-badge" aria-hidden>
                      {icon === "percent" ? (
                        <Percent size={14} strokeWidth={1.8} />
                      ) : (
                        <Gift size={14} strokeWidth={1.8} />
                      )}
                    </span>
                  </div>
                  <div className="promo-card-body">
                    <h3>{slide.promotion.title}</h3>
                    <p className="promo-card-discount">
                      {slide.promotion.discount}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="promo-trust wrap" aria-label={t("offersPage.trustTitle")}>
        <div className="promo-trust-item">
          <Truck size={18} strokeWidth={1.6} aria-hidden />
          <span>{t("offersPage.trust.shipping")}</span>
        </div>
        <div className="promo-trust-item">
          <BadgeCheck size={18} strokeWidth={1.6} aria-hidden />
          <span>{t("offersPage.trust.authentic")}</span>
        </div>
        <div className="promo-trust-item">
          <RotateCcw size={18} strokeWidth={1.6} aria-hidden />
          <span>{t("offersPage.trust.returns")}</span>
        </div>
        <div className="promo-trust-item">
          <ShieldCheck size={18} strokeWidth={1.6} aria-hidden />
          <span>{t("offersPage.trust.warranty")}</span>
        </div>
      </section>
    </div>
  );
}

function PromoProductCard({
  product,
  promo,
}: {
  product: Product;
  promo: Promotion;
}) {
  const { t } = useLocale();
  const image = product.images[0] || "/images/placeholder-frame.svg";
  const original = product.sellingPrice;
  const discounted = computeDiscountedPrice(original, promo);
  const hasDiscount = discounted < original - 0.001;
  const badge = discountBadgeLabel(promo);

  return (
    <article className="promo-product-card" role="listitem">
      <div className="promo-product-media">
        <Link
          href={`/product/${product.slug}`}
          className="promo-product-link"
          aria-label={product.name}
        >
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 767px) 42vw, 220px"
            className="object-cover"
          />
        </Link>
        {hasDiscount ? (
          <span className="promo-product-discount-badge">{badge}</span>
        ) : null}
      </div>
      <Link href={`/product/${product.slug}`} className="promo-product-name">
        {product.name}
      </Link>
      <div className="promo-product-prices">
        {hasDiscount ? (
          <>
            <span className="promo-product-price-was" aria-label={t("offersPage.wasPrice")}>
              {formatPrice(original)}
            </span>
            <strong className="promo-product-price promo-product-price-now">
              {formatPrice(discounted)}
            </strong>
          </>
        ) : (
          <strong className="promo-product-price">
            {formatPrice(original)}
          </strong>
        )}
      </div>
    </article>
  );
}
