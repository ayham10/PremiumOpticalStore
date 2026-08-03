"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";

export type CatalogueFilterKey =
  | "All"
  | "Prescription Frames"
  | "Sunglasses"
  | "Contact Lenses"
  | "Accessories";

export const CATALOGUE_FILTERS: CatalogueFilterKey[] = [
  "All",
  "Prescription Frames",
  "Sunglasses",
  "Contact Lenses",
  "Accessories",
];

const FILTER_HREFS: Record<CatalogueFilterKey, string> = {
  All: "/shop",
  "Prescription Frames": "/frames",
  Sunglasses: "/sunglasses",
  "Contact Lenses": "/contact-lenses",
  Accessories: "/shop?category=Accessories",
};

export function catalogueFilterLabel(
  key: CatalogueFilterKey,
  t: (key: string) => string,
): string {
  if (key === "All") return t("shop.all");
  if (key === "Prescription Frames") return t("shop.filterFrames");
  if (key === "Sunglasses") return t("shop.categories.Sunglasses");
  if (key === "Contact Lenses") return t("shop.categories.Contact Lenses");
  return t("shop.categories.Accessories");
}

/** Interactive filter chips for the Store page (local state). */
export function CatalogueFilterChips({
  active,
  onChange,
}: {
  active: CatalogueFilterKey;
  onChange: (value: CatalogueFilterKey) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="store-filters" role="tablist" aria-label={t("shop.title")}>
      {CATALOGUE_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={active === f}
          onClick={() => onChange(f)}
          className={`store-filter-chip${active === f ? " is-active" : ""}`}
        >
          {catalogueFilterLabel(f, t)}
        </button>
      ))}
    </div>
  );
}

/** Link chips for category catalogue pages (Frames / Sunglasses). */
export function CatalogueFilterNav({
  active,
}: {
  active: CatalogueFilterKey;
}) {
  const { t } = useLocale();
  return (
    <div className="store-filters" role="navigation" aria-label={t("shop.title")}>
      {CATALOGUE_FILTERS.map((f) => {
        const isActive = active === f;
        return (
          <Link
            key={f}
            href={FILTER_HREFS[f]}
            className={`store-filter-chip${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {catalogueFilterLabel(f, t)}
          </Link>
        );
      })}
    </div>
  );
}
