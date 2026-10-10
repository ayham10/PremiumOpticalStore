"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { categoryLabel } from "@/lib/catalog-categories";
import type { CatalogCategory } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

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
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((item) => {
      if (excludeId && item.id === excludeId) return false;
      if (!q) return true;
      const label = categoryLabel(item, locale).toLowerCase();
      return (
        label.includes(q) ||
        item.names.ar.toLowerCase().includes(q) ||
        item.names.he.toLowerCase().includes(q) ||
        item.names.en.toLowerCase().includes(q)
      );
    });
  }, [categories, excludeId, locale, query]);

  const selected = useMemo(
    () =>
      categories.filter(
        (item) => item.id !== excludeId && selectedIds.includes(item.id),
      ),
    [categories, excludeId, selectedIds],
  );

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <div className="admin-cat-multiselect">
      {selected.length > 0 ? (
        <div className="admin-cat-chips" aria-label={t("admin.catalog.selected")}>
          {selected.map((item) => (
            <button
              key={item.id}
              type="button"
              className="admin-cat-chip"
              onClick={() => toggle(item.id)}
            >
              <span>{categoryLabel(item, locale)}</span>
              <X size={12} strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <p className="admin-cat-hint">{t("admin.catalog.noneSelected")}</p>
      )}
      {categories.length > 8 ? (
        <input
          className="admin-pe-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("admin.catalog.search")}
          aria-label={t("admin.catalog.search")}
        />
      ) : null}
      <div className="admin-cat-options" role="group" aria-label={t("admin.catalog.extraCategories")}>
        {options.map((item) => {
          const checked = selectedIds.includes(item.id);
          const label = categoryLabel(item, locale);
          return (
            <label key={item.id} className={`admin-cat-option${checked ? " is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(item.id)}
              />
              <span className="admin-cat-option-name">{label}</span>
              {!item.showInMainCatalog ? (
                <span className="admin-cat-pill is-hidden">{t("admin.catalog.hidden")}</span>
              ) : null}
            </label>
          );
        })}
        {options.length === 0 ? (
          <p className="admin-cat-hint">{t("admin.catalog.noMatches")}</p>
        ) : null}
      </div>
    </div>
  );
}
