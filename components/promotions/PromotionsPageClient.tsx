"use client";

import { useEffect, useState } from "react";
import PromotionsExperience, {
  type PromoSlide,
} from "@/components/promotions/PromotionsExperience";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  cachedJsonFetch,
  peekPublicCache,
  promotionsSlidesCacheKey,
} from "@/lib/public-data-cache";

export default function PromotionsPageClient() {
  const { locale } = useLocale();
  const cacheKey = promotionsSlidesCacheKey(locale);
  const cached = peekPublicCache<{ slides: PromoSlide[] }>(cacheKey);
  const [slides, setSlides] = useState<PromoSlide[]>(cached?.slides || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let cancelled = false;
    const hit = peekPublicCache<{ slides: PromoSlide[] }>(cacheKey);
    if (hit?.slides) {
      setSlides(hit.slides);
      setLoading(false);
    }

    cachedJsonFetch<{ slides: PromoSlide[] }>(
      cacheKey,
      `/api/promotions?slides=1&locale=${encodeURIComponent(locale)}`,
      { ttlMs: 60_000 },
    )
      .then((data) => {
        if (!cancelled) {
          setSlides(data.slides || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlides([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, locale]);

  if (loading && slides.length === 0) {
    return (
      <div className="promo-page" aria-busy="true">
        <section className="promo-carousel">
          <div
            className="promo-slide-hero product-skeleton-block"
            style={{ minHeight: "200px" }}
          />
        </section>
        <section className="promo-section wrap">
          <div className="promo-product-rail">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="product-skeleton-block"
                style={{ width: "160px", height: "180px", flex: "0 0 auto" }}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return <PromotionsExperience slides={slides} />;
}
