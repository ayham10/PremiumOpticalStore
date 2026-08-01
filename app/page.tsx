import Link from "next/link";
import Image from "next/image";
import HomeHero from "@/components/home/HomeHero";
import GatewaySections from "@/components/home/GatewaySections";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import { getStore } from "@/lib/db/store";
import { isPromotionActive, dayLabel } from "@/lib/appointments";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LUMINA — Premium Optical Store & Eye Examinations",
  description:
    "See life in focus. Book eye exams and discover curated frames, lenses, and sunglasses.",
};

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const { settings, products, promotions, reviews } = data;

  const featured = products
    .filter((p) => p.featured && (p.status === "active" || p.status === "out_of_stock"))
    .slice(0, 4);

  const activePromos = promotions
    .filter(
      (p) =>
        p.homepageVisible && isPromotionActive(p.startDate, p.endDate, p.active)
    )
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  const testimonials = (
    reviews.filter((r) => r.featured).length
      ? reviews.filter((r) => r.featured)
      : reviews
  )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const hoursSummary = settings.openingHours
    .filter((h) => !h.closed)
    .slice(0, 3)
    .map((h) => `${dayLabel(h.day)} ${h.open}–${h.close}`)
    .join(" · ");

  return (
    <>
      <link rel="preload" href="/videos/hero.mp4" as="video" type="video/mp4" />
      <HomeHero />
      <GatewaySections />

      {featured.length > 0 && (
        <section className="section bg-white/50">
          <div className="wrap">
            <Reveal>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <span className="eyebrow">{t(dict, "home.featuredEyebrow")}</span>
                  <h2 className="section-title">{t(dict, "home.featuredTitle")}</h2>
                  <p className="section-lead">{t(dict, "home.featuredLead")}</p>
                </div>
                <Link href="/shop" className="btn btn-ghost self-start">
                  {t(dict, "home.featuredCta")}
                </Link>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((product, i) => (
                <Reveal key={product.id} delay={i * 60}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {activePromos.length > 0 && (
        <section id="offers" className="section scroll-mt-24">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">{t(dict, "home.offersEyebrow")}</span>
              <h2 className="section-title">{t(dict, "home.offersTitle")}</h2>
            </Reveal>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {activePromos.map((promo, i) => (
                <Reveal key={promo.id} delay={i * 70}>
                  <article className="overflow-hidden rounded-[1.35rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]">
                    {promo.image && (
                      <div className="relative aspect-[16/10]">
                        <Image
                          src={promo.image}
                          alt={promo.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <span className="pill">{promo.discount}</span>
                      <h3 className="mt-3 font-[family-name:var(--font-display)] text-2xl">
                        {promo.title}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--slate)]">
                        {promo.description}
                      </p>
                      <Link
                        href="/book"
                        className="btn btn-accent mt-5 !min-h-11 !px-5 !text-sm"
                      >
                        {t(dict, "home.offersCta")}
                      </Link>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="section bg-[var(--ink)] text-white">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow !text-[#9ec9e6]">
                {t(dict, "home.testimonialsEyebrow")}
              </span>
              <h2 className="section-title !text-white">
                {t(dict, "home.testimonialsTitle")}
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((review, i) => (
                <Reveal key={review.id} delay={i * 70}>
                  <blockquote className="h-full rounded-[1.35rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <div className="text-[#e3c789]" aria-label={`${review.rating} stars`}>
                      {"★".repeat(review.rating)}
                      {"☆".repeat(Math.max(0, 5 - review.rating))}
                    </div>
                    <p className="mt-4 text-white/80">{review.text}</p>
                    <footer className="mt-5 text-sm font-semibold text-white/90">
                      {review.name}
                    </footer>
                  </blockquote>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="wrap grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <span className="eyebrow">{t(dict, "home.visitEyebrow")}</span>
            <h2 className="section-title">{t(dict, "home.visitTitle")}</h2>
            <p className="mt-4 text-[var(--slate)]">
              {settings.address}
              <br />
              {settings.city}
            </p>
            <p className="mt-3 text-[var(--slate)]">
              {settings.phone}
              <br />
              {settings.email}
            </p>
            <p className="mt-3 text-sm text-[var(--slate)]">
              <strong className="text-[var(--ink)]">{t(dict, "home.visitHours")}: </strong>
              {hoursSummary}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary">
                {t(dict, "hero.ctaBook")}
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                {t(dict, "nav.contact")}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-[1.4rem] border border-[var(--line)] shadow-[var(--shadow)]">
              <iframe
                title="LUMINA map"
                src={settings.googleMapsEmbedUrl}
                className="h-[340px] w-full border-0 md:h-[420px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
