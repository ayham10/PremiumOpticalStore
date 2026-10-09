import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CustomServicePageView from "@/components/services/CustomServicePageView";
import {
  customPagesFromSettings,
  resolveCustomPageProducts,
  resolvePublishedCustomPage,
} from "@/lib/custom-service-pages";
import { getStore } from "@/lib/db/store";
import { getLocale } from "@/lib/i18n/get-dictionary";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function loadPublished(slug: string) {
  const locale = await getLocale();
  const { data } = await getStore();
  const pages = customPagesFromSettings(data.settings.servicePages);
  return resolvePublishedCustomPage(pages, slug, locale);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await loadPublished(slug);
  if (!resolved) return { title: "OYON Optical" };
  return {
    title: `${resolved.copy.title} | OYON Optical`,
    description: resolved.copy.description,
  };
}

export default async function CustomServiceRoute({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const { data } = await getStore();
  const pages = customPagesFromSettings(data.settings.servicePages);
  const resolved = resolvePublishedCustomPage(pages, slug, locale);
  if (!resolved) notFound();
  const products = resolveCustomPageProducts(
    data.products,
    resolved.page.productIds,
  );
  return (
    <CustomServicePageView
      page={resolved.page}
      copy={resolved.copy}
      products={products}
      currencySymbol={data.settings.currencySymbol}
    />
  );
}
