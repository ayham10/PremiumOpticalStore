import type { Metadata } from "next";
import ProductDetailClient from "@/components/product/ProductDetailClient";
import { getStore } from "@/lib/db/store";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  try {
    const { data } = await getStore();
    const product = data.products.find((p) => p.slug === slug);
    if (!product) return { title: "Product — Oyon" };
    const description =
      dict.product.descriptions[product.slug] || product.description;
    return {
      title: `${product.name} — Oyon`,
      description,
    };
  } catch {
    return { title: "Product — Oyon" };
  }
}

/** Shell renders immediately; product body loads via cached client fetch. */
export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
