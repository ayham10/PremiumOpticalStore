"use client";

import { useMemo, useState } from "react";
import { Check, Package, Plus, Search, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { membershipIsProductType } from "@/lib/catalog-categories";
import type { Product, ProductCategory } from "@/lib/types";
import { PRODUCT_TYPES } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

export default function CategoryProductAssigner({
  products,
  categoryId,
  selectedIds,
  typeLabel,
  t,
  onChange,
  onAddNew,
}: {
  products: Product[];
  categoryId: string;
  selectedIds: string[];
  typeLabel: (id: string) => string;
  t: Translate;
  onChange: (ids: string[]) => void;
  onAddNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const chosen = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (typeFilter !== "all" && product.category !== typeFilter) return false;
      if (!q) return true;
      return [product.name, product.brand, product.sku, product.category]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [products, query, typeFilter]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <div className="admin-cat-assign">
      <h3>{t("admin.catalog.manageProducts")}</h3>
      <div className="admin-cat-assign-actions">
        <button
          type="button"
          className="admin-products-manage"
          onClick={() => {
            const input = document.getElementById("admin-cat-product-search");
            input?.focus();
          }}
        >
          <Search size={14} />
          {t("admin.catalog.chooseExisting")}
        </button>
        <button type="button" className="admin-products-add" onClick={onAddNew}>
          <Plus size={14} />
          {t("admin.catalog.addNewProduct")}
        </button>
      </div>

      {chosen.length > 0 ? (
        <div className="admin-cat-chips" aria-label={t("admin.catalog.selectedProducts")}>
          {chosen.map((product) => {
            const locked = membershipIsProductType(product, categoryId);
            return (
              <button
                key={product.id}
                type="button"
                className="admin-cat-chip"
                disabled={locked}
                title={locked ? t("admin.catalog.typeMembershipLocked") : t("admin.catalog.removeProduct")}
                onClick={() => {
                  if (!locked) toggle(product.id);
                }}
              >
                <span>{product.name}</span>
                {locked ? null : <X size={12} strokeWidth={2} aria-hidden />}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="admin-cat-hint">{t("admin.catalog.noProductsYet")}</p>
      )}

      <div className="admin-cat-assign-filters">
        <label className="admin-cat-search">
          <Search size={14} />
          <input
            id="admin-cat-product-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.catalog.searchProducts")}
            aria-label={t("admin.catalog.searchProducts")}
          />
        </label>
        <select
          className="input"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label={t("admin.catalog.productType")}
        >
          <option value="all">{t("admin.catalog.allProductTypes")}</option>
          {PRODUCT_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-cat-assign-list" role="listbox" aria-multiselectable>
        {visible.map((product) => {
          const checked = selectedIds.includes(product.id);
          const thumb = product.images?.[0];
          const locked = membershipIsProductType(product, categoryId) && checked;
          return (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={checked}
              className={`csp-product-pick${checked ? " is-selected" : ""}`}
              disabled={locked}
              onClick={() => toggle(product.id)}
            >
              <span className="csp-product-pick-thumb">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" />
                ) : (
                  <Package size={16} />
                )}
              </span>
              <span className="csp-product-pick-copy">
                <strong>{product.name}</strong>
                <small>
                  {typeLabel(product.category as ProductCategory)} · {formatPrice(product.sellingPrice)}
                </small>
              </span>
              {checked ? <Check size={16} /> : null}
            </button>
          );
        })}
        {visible.length === 0 ? (
          <p className="admin-cat-hint">{t("admin.catalog.noProductMatches")}</p>
        ) : null}
      </div>
    </div>
  );
}
