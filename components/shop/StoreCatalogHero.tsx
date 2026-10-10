"use client";

import Image from "next/image";
import { useLocale } from "@/components/i18n/LocaleProvider";
import PageHeroMedia from "@/components/media/PageHeroMedia";
import { catalogHeroImage, DEFAULT_CATALOG_HERO_IMAGE } from "@/lib/page-hero-media";
import { pickServiceText } from "@/lib/service-pages";
import { useLocalizedServicePages } from "@/lib/use-service-pages";

export default function StoreCatalogHero() {
  const { t } = useLocale();
  const saved = useLocalizedServicePages()?.catalog;
  const title = pickServiceText(saved?.title, t("shop.title"));
  const lead = pickServiceText(saved?.lead, t("shop.lead"));
  const media = catalogHeroImage(saved?.heroMedia);

  return (
    <section
      className="frames-hero store-hero"
      aria-label={title}
      data-csp-section="catalog-hero"
    >
      <PageHeroMedia
        media={media}
        alt=""
        className="object-cover store-hero-image"
        fallback={
          <Image
            src={DEFAULT_CATALOG_HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover store-hero-image"
          />
        }
      />
      <span className="frames-hero-veil store-hero-veil" aria-hidden />
      <div className="catalogue-hero-copy store-hero-copy">
        <h1 className="catalogue-hero-title">{title}</h1>
        <p className="catalogue-hero-lead">{lead}</p>
      </div>
    </section>
  );
}
