"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Gift,
  Heart,
  Percent,
  ShieldCheck,
  Truck,
  BadgeCheck,
  RotateCcw,
} from "lucide-react";
import SaveReturnLink from "@/components/navigation/SaveReturnLink";
import ScrollRestore from "@/components/navigation/ScrollRestore";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product, Promotion } from "@/lib/types";

const FALLBACK_HERO = "/images/store-hero.jpg";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function endOfDay(dateStr: string) {
  const d = new Date(`${dateStr}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function useCountdown(endDate?: string): Countdown | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!endDate) return null;
    const end = endOfDay(endDate);
    if (!end) return null;
    const diff = Math.max(0, end.getTime() - now);
    const totalSec = Math.floor(diff / 1000);
    return {
      days: Math.floor(totalSec / 86400),
      hours: Math.floor((totalSec % 86400) / 3600),
      minutes: Math.floor((totalSec % 3600) / 60),
      seconds: totalSec % 60,
    };
  }, [endDate, now]);
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function promoIcon(discount: string) {
  const lower = discount.toLowerCase();
  if (lower.includes("free") || lower.includes("هدية") || lower.includes("%")) {
    if (lower.includes("free") || lower.includes("هدية")) return "gift";
  }
  if (/\d+\s*%/.test(discount) || discount.includes("%")) return "percent";
  return "gift";
}

function isRecent(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < 1000 * 60 * 60 * 24 * 21;
}

export default function PromotionsExperience({
  featured,
  promotions,
  products,
}: {
  featured: Promotion | null;
  promotions: Promotion[];
  products: Product[];
}) {
  const { t, locale, rtl } = useLocale();
  const countdown = useCountdown(featured?.endDate);
  const heroImage = featured?.image || FALLBACK_HERO;

  return (
    <div className="promo-page">
      <ScrollRestore />

      <section className="promo-hero" aria-label={featured?.title || t("offersPage.title")}>
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover promo-hero-image"
        />
        <span className="promo-hero-veil" aria-hidden />
        <div className="promo-hero-copy wrap">
          <p className="promo-hero-eyebrow">{t("offersPage.limitedTime")}</p>
          <h1 className="promo-hero-title">
            {featured?.discount || t("offersPage.title")}
          </h1>
          <p className="promo-hero-lead">
            {featured?.title || t("offersPage.lead")}
          </p>

          {countdown ? (
            <div className="promo-countdown" aria-live="polite">
              <p className="promo-countdown-label">{t("offersPage.endsIn")}</p>
              <div className="promo-countdown-grid">
                {(
                  [
                    ["days", countdown.days],
                    ["hours", countdown.hours],
                    ["minutes", countdown.minutes],
                    ["seconds", countdown.seconds],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="promo-countdown-cell">
                    <strong>{pad(value)}</strong>
                    <span>{t(`offersPage.${key}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Link href="/shop" className="promo-hero-cta">
            <span>{t("offersPage.shopOffer")}</span>
            <ArrowLeft
              size={16}
              strokeWidth={1.8}
              className={rtl ? undefined : "promo-hero-cta-icon-ltr"}
            />
          </Link>
        </div>
      </section>

      <section className="promo-section wrap">
        <header className="promo-section-head">
          <span className="promo-section-rule" aria-hidden />
          <h2>{t("offersPage.activeOffers")}</h2>
          <span className="promo-section-rule" aria-hidden />
        </header>

        {promotions.length === 0 ? (
          <p className="promo-empty">{t("offersPage.empty")}</p>
        ) : (
          <div className="promo-card-rail">
            {promotions.map((promo, index) => {
              const icon = promoIcon(promo.discount);
              const highlighted = featured?.id === promo.id || index === 0;
              return (
                <article
                  key={promo.id}
                  className={`promo-card${highlighted ? " is-featured" : ""}`}
                >
                  <div className="promo-card-media">
                    <Image
                      src={promo.image || FALLBACK_HERO}
                      alt={promo.title}
                      fill
                      sizes="(max-width: 767px) 70vw, 280px"
                      className="object-cover"
                    />
                    {isRecent(promo.createdAt) ? (
                      <span className="promo-card-new">{t("offersPage.newBadge")}</span>
                    ) : null}
                    <span className="promo-card-badge" aria-hidden>
                      {icon === "percent" ? (
                        <Percent size={14} strokeWidth={1.8} />
                      ) : (
                        <Gift size={14} strokeWidth={1.8} />
                      )}
                    </span>
                  </div>
                  <div className="promo-card-body">
                    <h3>{promo.title}</h3>
                    <p className="promo-card-discount">{promo.discount}</p>
                    {promo.couponCode ? (
                      <p className="promo-card-code">
                        {t("offersPage.code")}: <strong>{promo.couponCode}</strong>
                      </p>
                    ) : null}
                    <p className="promo-card-until">
                      <Calendar size={13} strokeWidth={1.7} aria-hidden />
                      <span>
                        {t("offersPage.until")} {formatUntil(promo.endDate, locale)}
                      </span>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {products.length > 0 ? (
        <section className="promo-section wrap">
          <header className="promo-section-head">
            <span className="promo-section-rule" aria-hidden />
            <h2>{t("offersPage.offerProducts")}</h2>
            <span className="promo-section-rule" aria-hidden />
          </header>

          <div className="promo-product-rail" role="list">
            {products.map((product) => (
              <PromoProductCard key={product.id} product={product} />
            ))}
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

function PromoProductCard({ product }: { product: Product }) {
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
    <article className="promo-product-card" role="listitem">
      <div className="promo-product-media">
        <SaveReturnLink
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
        </SaveReturnLink>
        {product.featured ? (
          <span className="promo-product-tag">★</span>
        ) : null}
        <button
          type="button"
          className={`promo-product-wish${saved ? " is-active" : ""}`}
          aria-label={t("shop.wishlist")}
          aria-pressed={saved}
          onClick={toggleWish}
        >
          <Heart size={14} strokeWidth={1.6} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <SaveReturnLink href={`/product/${product.slug}`} className="promo-product-name">
        {product.name}
      </SaveReturnLink>
      <strong className="promo-product-price">
        {formatPrice(product.sellingPrice)}
      </strong>
    </article>
  );
}
