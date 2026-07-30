import Link from "next/link";
import Image from "next/image";
import Reveal from "@/components/Reveal";
import ProductCard from "@/components/ProductCard";
import { getStore } from "@/lib/db/store";
import { SERVICES, GALLERY_IMAGES } from "@/lib/seed";
import { isPromotionActive, dayLabel } from "@/lib/appointments";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LUMINA — Premium Optical Store & Eye Examinations",
  description:
    "Precision vision. Quiet luxury. Book eye exams and discover curated frames, lenses, and sunglasses.",
};

const MARQUEE_WORDS = [
  "Clarity",
  "Precision",
  "Acetate",
  "Titanium",
  "Progressive",
  "Polarized",
  "Atelier",
  "Fitting",
  "Quiet Luxury",
  "Blue Light",
];

const PILLARS = [
  {
    title: "Clinical precision",
    text: "Comprehensive exams with modern diagnostics and unhurried attention to every detail of your vision.",
  },
  {
    title: "Curated frames",
    text: "An edited collection of acetate, titanium, and metal — chosen for silhouette, comfort, and longevity.",
  },
  {
    title: "Effortless booking",
    text: "Reserve your eye exam online in minutes. Confirmations, reminders, and easy rescheduling included.",
  },
];

export default async function HomePage() {
  const { data } = await getStore();
  const { settings, products, promotions, reviews, media } = data;

  const featured = products
    .filter((p) => p.featured && (p.status === "active" || p.status === "out_of_stock"))
    .slice(0, 4);

  const activePromos = promotions
    .filter(
      (p) =>
        p.homepageVisible &&
        isPromotionActive(p.startDate, p.endDate, p.active)
    )
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  const testimonials = (reviews.filter((r) => r.featured).length
    ? reviews.filter((r) => r.featured)
    : reviews
  )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const brands = Array.from(
    new Set(products.filter((p) => p.status === "active").map((p) => p.brand))
  ).slice(0, 8);

  const gallery =
    media.filter((m) => m.folder === "gallery" && m.type === "image").length > 0
      ? media
          .filter((m) => m.folder === "gallery" && m.type === "image")
          .map((m) => m.url)
          .slice(0, 6)
      : GALLERY_IMAGES;

  const hoursSummary = settings.openingHours
    .filter((h) => !h.closed)
    .slice(0, 3)
    .map((h) => `${dayLabel(h.day)} ${h.open}–${h.close}`)
    .join(" · ");

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[100svh] overflow-hidden text-white">
        <video
          className="hero-video"
          src="/videos/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          poster="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1600&q=80"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,20,0.55) 0%, rgba(10,14,20,0.35) 40%, rgba(10,14,20,0.72) 100%)",
          }}
        />
        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:justify-center md:pb-24">
          <div className="wrap max-w-3xl">
            <div
              className="font-[family-name:var(--font-display)] text-[clamp(3.8rem,12vw,7.5rem)] leading-[0.92] tracking-[0.06em]"
              style={{
                animation: "fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              LUM<span style={{ color: "#9ec9e6" }}>I</span>NA
            </div>
            <h1
              className="mt-6 max-w-xl text-[clamp(1.55rem,3.5vw,2.35rem)] font-normal text-white"
              style={{
                animation: "fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both",
              }}
            >
              Precision vision. Quiet luxury.
            </h1>
            <p
              className="mt-4 max-w-md text-[1.05rem] text-white/75"
              style={{
                animation: "fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both",
              }}
            >
              Premium optical care — refined examinations, curated frames, and
              lenses fitted with absolute clarity.
            </p>
            <div
              className="mt-9 flex flex-wrap gap-3"
              style={{
                animation: "fadeUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.34s both",
              }}
            >
              <Link href="/book" className="btn btn-primary !bg-white !text-[var(--ink)]">
                Book Eye Exam
              </Link>
              <Link
                href="/shop"
                className="btn btn-ghost !border-white/35 !text-white hover:!border-white hover:!text-white"
              >
                Browse Glasses
              </Link>
              <Link
                href="/contact"
                className="btn btn-ghost !border-white/35 !text-white hover:!border-white hover:!text-white"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-[var(--line)] bg-white/60 py-5">
        <div className="marquee-track gap-10 px-4 text-sm font-semibold uppercase tracking-[0.28em] text-[var(--slate)]">
          {[...MARQUEE_WORDS, ...MARQUEE_WORDS].map((word, i) => (
            <span key={`${word}-${i}`} className="inline-flex items-center gap-10">
              {word}
              <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />
            </span>
          ))}
        </div>
      </div>

      {/* About teaser */}
      <section className="section">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)] md:aspect-[5/4]">
              <Image
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80"
                alt="LUMINA optical atelier"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <span className="eyebrow">The atelier</span>
            <h2 className="section-title">Vision crafted with restraint</h2>
            <p className="section-lead">
              LUMINA is a modern optical house where clinical precision meets a
              quiet, elevated retail experience. Every frame is chosen, every
              lens measured, every appointment unhurried.
            </p>
            <Link href="/about" className="btn btn-ghost mt-8">
              Our story
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Why choose us */}
      <section className="section !pt-0">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Why LUMINA</span>
            <h2 className="section-title">Three quiet promises</h2>
          </Reveal>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {PILLARS.map((pillar, i) => (
              <Reveal key={pillar.title} delay={i * 100}>
                <div className="border-t border-[var(--line-strong)] pt-6">
                  <div className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)]">
                    0{i + 1}
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[0.98rem]">{pillar.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="section bg-white/50">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Services</span>
            <h2 className="section-title">Care for every kind of sight</h2>
            <p className="section-lead">
              From comprehensive exams to precision fittings — book the service
              that fits your vision.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, i) => (
              <Reveal key={service.key} delay={i * 70}>
                <article className="group relative overflow-hidden rounded-[var(--radius)]">
                  <div className="relative aspect-[5/4]">
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-[1.04]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,14,20,0.82)] via-[rgba(10,14,20,0.25)] to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <h3 className="font-[family-name:var(--font-display)] text-2xl">
                      {service.title}
                    </h3>
                    <p className="mt-2 text-sm text-white/75">{service.description}</p>
                    <Link
                      href={`/book?service=${encodeURIComponent(service.key)}`}
                      className="mt-4 inline-flex text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
                    >
                      Book this service
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products */}
      <section className="section">
        <div className="wrap">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Reveal>
              <span className="eyebrow">Collection</span>
              <h2 className="section-title">Featured frames & lenses</h2>
              <p className="section-lead">
                A refined edit of prescription glasses, sunglasses, and daily
                essentials.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <Link href="/shop" className="btn btn-ghost">
                View all
              </Link>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, i) => (
              <Reveal key={product.id} delay={i * 80}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Brands */}
      {brands.length > 0 && (
        <section className="border-y border-[var(--line)] bg-white/70 py-10">
          <div className="wrap">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {brands.map((brand) => (
                <span
                  key={brand}
                  className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--ink-soft)] opacity-70"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Promotions */}
      {activePromos.length > 0 && (
        <section className="section">
          <div className="wrap">
            <Reveal>
              <span className="eyebrow">Offers</span>
              <h2 className="section-title">Current promotions</h2>
            </Reveal>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {activePromos.map((promo, i) => (
                <Reveal key={promo.id} delay={i * 90}>
                  <article className="relative overflow-hidden rounded-[var(--radius)] bg-[var(--ink)] text-white min-h-[240px]">
                    {promo.image && (
                      <Image
                        src={promo.image}
                        alt=""
                        fill
                        className="object-cover opacity-35"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    )}
                    <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-10">
                      <span className="pill !bg-white/15 !text-white">
                        {promo.discount}
                      </span>
                      <h3 className="mt-4 font-[family-name:var(--font-display)] text-3xl">
                        {promo.title}
                      </h3>
                      <p className="mt-3 max-w-md text-white/75">{promo.description}</p>
                      {promo.couponCode && (
                        <p className="mt-4 text-sm font-semibold tracking-wide">
                          Code: {promo.couponCode}
                        </p>
                      )}
                      <Link href="/book" className="btn btn-glass mt-6 w-fit">
                        Book now
                      </Link>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="section !pt-0">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Testimonials</span>
            <h2 className="section-title">Words from our patients</h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {testimonials.map((review, i) => (
              <Reveal key={review.id} delay={i * 90}>
                <blockquote className="border-t border-[var(--line-strong)] pt-6">
                  <div className="flex gap-1 text-[var(--copper)]" aria-label={`${review.rating} stars`}>
                    {Array.from({ length: 5 }).map((_, star) => (
                      <span key={star} className={star < review.rating ? "opacity-100" : "opacity-25"}>
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-[1.05rem] leading-relaxed text-[var(--ink-soft)]">
                    “{review.text}”
                  </p>
                  <footer className="mt-5 text-sm font-semibold tracking-wide text-[var(--accent)]">
                    {review.name}
                  </footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery teaser */}
      <section className="section bg-white/50">
        <div className="wrap">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Reveal>
              <span className="eyebrow">Gallery</span>
              <h2 className="section-title">Inside the store</h2>
              <p className="section-lead">
                Frames, fittings, and the quiet atmosphere of our Tel Aviv atelier.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <Link href="/gallery" className="btn btn-ghost">
                Open gallery
              </Link>
            </Reveal>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {gallery.slice(0, 6).map((url, i) => (
              <Reveal key={url + i} delay={i * 60}>
                <Link
                  href="/gallery"
                  className={`group relative block overflow-hidden rounded-[var(--radius-sm)] ${
                    i === 0 ? "md:col-span-2 md:row-span-2" : ""
                  }`}
                >
                  <div className={`relative ${i === 0 ? "aspect-[4/3] md:aspect-square" : "aspect-square"}`}>
                    <Image
                      src={url}
                      alt={`LUMINA gallery ${i + 1}`}
                      fill
                      className="object-cover transition duration-700 group-hover:scale-[1.05]"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-[var(--ink)]/0 transition group-hover:bg-[var(--ink)]/20" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="section">
        <div className="wrap grid gap-10 lg:grid-cols-2 lg:items-stretch">
          <Reveal>
            <span className="eyebrow">Visit</span>
            <h2 className="section-title">Find LUMINA</h2>
            <p className="section-lead">
              {settings.address}
              <br />
              {settings.city}
            </p>
            <div className="mt-6 space-y-2 text-[var(--ink-soft)]">
              <p>
                <a href={`tel:${settings.phone}`} className="hover:text-[var(--accent)]">
                  {settings.phone}
                </a>
              </p>
              <p>
                <a href={`mailto:${settings.email}`} className="hover:text-[var(--accent)]">
                  {settings.email}
                </a>
              </p>
              {hoursSummary && (
                <p className="pt-2 text-sm text-[var(--slate)]">{hoursSummary}</p>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="btn btn-primary">
                Contact Us
              </Link>
              <Link href="/book" className="btn btn-ghost">
                Book Eye Exam
              </Link>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="min-h-[320px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--mist)]">
              <iframe
                title="LUMINA location map"
                src={settings.googleMapsEmbedUrl}
                className="h-full min-h-[320px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
