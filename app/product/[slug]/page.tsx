import type { Metadata } from "next";
import ProductDetailClient from "@/components/product/ProductDetailClient";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    ? `${slug.replace(/-/g, " ")} — Oyon`
    : "Product — Oyon";
  return { title };
}

/** Instant shell — product body loads via cached client fetch. */
export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
