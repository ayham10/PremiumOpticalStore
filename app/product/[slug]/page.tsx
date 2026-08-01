import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import ProductCard from "@/components/ProductCard";
import { getStore } from "@/lib/db/store";
import { formatPrice } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await getStore();
  const product = data.products.find((p) => p.slug === slug);
  if (!product) return { title: "Product — LUMINA" };
  return {
    title: `${product.name} — LUMINA`,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const product = data.products.find((p) => p.slug === slug);

  if (!product || product.status === "archived" || product.status === "draft") {
    notFound();
  }

  const related = data.products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.category === product.category &&
        (p.status === "active" || p.status === "out_of_stock")
    )
    .slice(0, 3);

  const whatsapp = data.settings.whatsapp || "9725550180";
  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Hello LUMINA, I'm interested in ${product.name} (${product.sku}).`
  )}`;

  const images =
    product.images.length > 0
      ? product.images
      : ["/images/placeholder-frame.svg"];

  const availabilityLabel =
    product.status === "out_of_stock"
      ? t(dict, "product.outOfStock")
      : product.stockQuantity > 0
        ? t(dict, "product.inStore")
        : t(dict, "product.availability");

  const categoryLabel =
    dict.shop.categories[product.category as keyof typeof dict.shop.categories] ||
    product.category;

  return (
    <div className="pb-20 pt-28">
      <div className="wrap">
        <div className="mb-8 text-sm text-[var(--slate)]">
          <Link href="/shop" className="hover:text-[var(--accent)]">
            {t(dict, "product.shop")}
          </Link>
          <span className="mx-2">/</span>
          <span>{categoryLabel}</span>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="space-y-3">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius)] bg-[var(--mist)]">
                <Image
                  src={images[0]}
                  alt={product.name}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-3 gap-3">
                  {images.slice(1, 4).map((src) => (
                    <div
                      key={src}
                      className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--mist)]"
                    >
                      <Image
                        src={src}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <span className="eyebrow">{product.brand}</span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.4rem,5vw,3.6rem)]">
              {product.name}
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
              {categoryLabel}
            </p>
            <p className="mt-6 text-3xl font-semibold">
              {formatPrice(product.sellingPrice, data.settings)}
            </p>
            {product.status === "out_of_stock" && (
              <span className="pill mt-3 !bg-[#fdeaea] !text-[var(--danger)]">
                {t(dict, "product.outOfStock")}
              </span>
            )}
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed">
              {product.description}
            </p>

            <dl className="mt-8 grid gap-4 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
              {product.frameType && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
                    {t(dict, "product.frame")}
                  </dt>
                  <dd className="mt-1 text-[var(--ink-soft)]">{product.frameType}</dd>
                </div>
              )}
              {product.lensType && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
                    {t(dict, "product.lens")}
                  </dt>
                  <dd className="mt-1 text-[var(--ink-soft)]">{product.lensType}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
                  {t(dict, "product.sku")}
                </dt>
                <dd className="mt-1 text-[var(--ink-soft)]">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--slate)]">
                  {t(dict, "product.availability")}
                </dt>
                <dd className="mt-1 text-[var(--ink-soft)]">{availabilityLabel}</dd>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/book?service=Vision%20Consultation" className="btn btn-primary">
                {t(dict, "product.bookConsultation")}
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
              >
                {t(dict, "product.whatsapp")}
              </a>
            </div>
          </Reveal>
        </div>

        {related.length > 0 && (
          <section className="mt-24">
            <Reveal>
              <span className="eyebrow">{t(dict, "product.related")}</span>
              <h2 className="section-title !text-[clamp(1.8rem,4vw,2.6rem)]">
                {t(dict, "product.related")}
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item, i) => (
                <Reveal key={item.id} delay={i * 70}>
                  <ProductCard product={item} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
