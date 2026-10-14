"use client";

import { useMemo } from "react";
import { categoryLabel } from "@/lib/catalog-categories";
import type { CatalogCategory } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";
import AdminPeekMultiSelect from "@/components/admin/AdminPeekMultiSelect";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function ProductCategoryMultiSelect({
  categories,
  selectedIds,
  excludeId,
  locale,
  t,
  onChange,
}: {
  categories: CatalogCategory[];
  selectedIds: string[];
  excludeId?: string;
  locale: Locale | string;
  t: Translate;
  onChange: (ids: string[]) => void;
}) {
  const options = useMemo(
    () =>
      categories
        .filter((item) => item.id !== excludeId)
        .map((item) => ({
          id: item.id,
          label: categoryLabel(item, locale),
          hint: item.showInMainCatalog ? undefined : t("admin.catalog.hidden"),
        })),
    [categories, excludeId, locale, t],
  );

  return (
    <AdminPeekMultiSelect
      options={options}
      selectedIds={selectedIds}
      onChange={onChange}
      placeholder={t("admin.catalog.noneSelected")}
      selectedLabel={t("admin.catalog.selected")}
      emptyLabel={t("admin.catalog.noMatches")}
      ariaLabel={t("admin.catalog.extraCategories")}
    />
  );
}
