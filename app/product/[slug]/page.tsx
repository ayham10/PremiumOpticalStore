import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import RelatedProductsCarousel from "@/components/product/RelatedProductsCarousel";
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
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const { data } = await getStore();
  const product = data.products.find((p) => p.slug === slug);
  if (!product) return { title: "Product — LUMINA" };
  const description =
    dict.product.descriptions[product.slug] || product.description;
  return {
    title: `${product.name} — LUMINA`,
    description,
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
        (p.status === "active" || p.status === "out_of_stock"),
    )
    .slice(0, 8);

  const whatsapp = data.settings.whatsapp || "9725550180";
  const waHref = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Hello LUMINA, I'm interested in ${product.name} (${product.sku}).`,
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

  const description =
    dict.product.descriptions[product.slug] || product.description;

  const frameLabel = product.frameType
    ? dict.product.attrs[product.frameType] || product.frameType
    : null;
  const lensLabel = product.lensType
    ? dict.product.attrs[product.lensType] || product.lensType
    : null;

  return (
    <div className="product-page">
      <div className="product-page-inner wrap">
        <nav className="product-breadcrumb" aria-label="Breadcrumb">
          <Link href="/shop">{t(dict, "product.shop")}</Link>
          <span aria-hidden>/</span>
          <span>{categoryLabel}</span>
        </nav>

        <div className="product-layout">
          <div className="product-gallery">
            <div className="product-image-frame">
              <Image
                src={images[0]}
                alt={product.name}
                fill
                priority
                className="object-contain"
                sizes="(max-width: 1023px) 100vw, 520px"
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
              {formatPrice(product.sellingPrice, data.settings)}
            </p>
            {product.status === "out_of_stock" ? (
              <span className="product-stock-pill">
                {t(dict, "product.outOfStock")}
              </span>
            ) : null}
            <p className="product-description">{description}</p>

            <dl className="product-meta">
              {frameLabel ? (
                <div>
                  <dt>{t(dict, "product.frame")}</dt>
                  <dd>{frameLabel}</dd>
                </div>
              ) : null}
              {lensLabel ? (
                <div>
                  <dt>{t(dict, "product.lens")}</dt>
                  <dd>{lensLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt>{t(dict, "product.sku")}</dt>
                <dd>{product.sku}</dd>
              </div>
              <div>
                <dt>{t(dict, "product.availability")}</dt>
                <dd>{availabilityLabel}</dd>
              </div>
            </dl>

            <div className="product-actions">
              <Link
                href="/book?service=Vision%20Consultation"
                className="btn btn-copper product-btn"
              >
                {t(dict, "product.bookConsultation")}
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn product-btn product-btn-secondary"
              >
                {t(dict, "product.whatsapp")}
              </a>
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <RelatedProductsCarousel
            products={related}
            currencySymbol={data.settings.currencySymbol}
          />
        ) : null}
      </div>
    </div>
  );
}
