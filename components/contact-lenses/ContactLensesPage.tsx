"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck2,
  Droplets,
  HeartHandshake,
  Ruler,
} from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

function ContactLensCard({ product }: { product: Product }) {
  const { t, dict } = useLocale();
  const image = product.images[0] || "/images/placeholder-frame.svg";
  const typeLabel = product.lensType
    ? dict.product.attrs[product.lensType] || product.lensType
    : null;

  return (
    <article className="frames-product-card cl-product-card">
      <Link
        href={`/product/${product.slug}`}
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
        <Link href={`/product/${product.slug}`} className="frames-product-name">
          {product.name}
        </Link>
        <div className="frames-product-meta">
          <strong className="frames-product-price">
            {formatPrice(product.sellingPrice)}
          </strong>
          <Link href={`/product/${product.slug}`} className="frames-product-view">
            {t("shop.view")}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function ContactLensesPage() {
  const { t, rtl } = useLocale();
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
        const res = await fetch("/api/products?category=Contact%20Lenses");
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

  const items = useMemo(
    () => products.filter((p) => p.status === "active"),
    [products],
  );

  const infoCards = [
    {
      icon: Ruler,
      title: t("contactLenses.info.fittingTitle"),
      text: t("contactLenses.info.fittingText"),
    },
    {
      icon: Droplets,
      title: t("contactLenses.info.optionsTitle"),
      text: t("contactLenses.info.optionsText"),
    },
    {
      icon: HeartHandshake,
      title: t("contactLenses.info.supportTitle"),
      text: t("contactLenses.info.supportText"),
    },
  ];

  return (
    <div className="frames-page cl-page" dir={rtl ? "rtl" : "ltr"}>
      <section className="frames-hero" aria-label={t("contactLenses.title")}>
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
            className="frames-hero-video"
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
        <span className="frames-hero-veil" aria-hidden />
      </section>

      <section className="frames-catalogue wrap cl-content">
        <header className="frames-catalogue-head cl-head">
          <p className="cl-eyebrow">{t("contactLenses.eyebrow")}</p>
          <h1 className="frames-catalogue-title">{t("contactLenses.title")}</h1>
          <p className="frames-catalogue-lead">{t("contactLenses.description")}</p>
        </header>

        <div className="cl-info-grid" aria-label={t("contactLenses.info.aria")}>
          {infoCards.map((card) => (
            <article key={card.title} className="cl-info-card">
              <card.icon className="cl-info-icon" size={20} aria-hidden />
              <h2>{card.title}</h2>
              <p>{card.text}</p>
            </article>
          ))}
        </div>

        <aside className="cl-safety" role="note">
          <AlertTriangle className="cl-safety-icon" size={18} aria-hidden />
          <p>{t("contactLenses.safety")}</p>
        </aside>

        <div className="cl-booking-row">
          <Link
            href="/book?type=contact_lens_fitting"
            className="btn btn-copper cl-book-btn"
          >
            <CalendarCheck2 size={18} aria-hidden />
            {t("contactLenses.bookCta")}
          </Link>
        </div>

        <div className="cl-catalogue-block">
          <h2 className="cl-catalogue-title">{t("contactLenses.catalogueTitle")}</h2>
          {loading ? (
            <div className="frames-product-grid" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="frames-product-skeleton" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="frames-empty">{t("shop.empty")}</p>
          ) : (
            <div className="frames-product-grid contact-lens-grid">
              {items.map((product) => (
                <ContactLensCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
