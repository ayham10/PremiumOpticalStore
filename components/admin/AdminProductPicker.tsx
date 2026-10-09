"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Package, Search } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

function unwrapProducts(data: unknown): Product[] {
  if (Array.isArray(data)) return data as Product[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.products)) return obj.products as Product[];
  }
  return [];
}

export default function AdminProductPicker({
  open,
  t,
  selectedIds,
  remaining,
  onClose,
  onPick,
}: {
  open: boolean;
  t: Translate;
  selectedIds: string[];
  remaining: number;
  onClose: () => void;
  onPick: (products: Product[]) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setChosen([]);
    setError("");
    setLoading(true);
    apiFetch<unknown>("/api/products?all=1")
      .then((data) => setProducts(unwrapProducts(data)))
      .catch((err) => {
        setProducts([]);
        setError(err instanceof Error ? err.message : t("admin.servicePages.productLoadError"));
      })
      .finally(() => setLoading(false));
  }, [open, t]);

  const attached = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (attached.has(product.id)) return false;
      if (!q) return true;
      return [product.name, product.brand, product.sku, product.category]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [products, query, attached]);

  function toggle(id: string) {
    setChosen((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= remaining) return prev;
      return [...prev, id];
    });
  }

  function confirm() {
    const picked = products.filter((product) => chosen.includes(product.id));
    if (picked.length) onPick(picked);
    onClose();
  }

  return (
    <AdminModal
      open={open}
      title={t("admin.servicePages.chooseExistingProduct")}
      onClose={onClose}
      wide
      icon={<Package size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <label className="admin-service-field">
        <span className="label">{t("admin.servicePages.productSearch")}</span>
        <span className="csp-search">
          <Search size={16} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.servicePages.productSearch")}
          />
        </span>
      </label>
      <p className="admin-muted">
        {t("admin.servicePages.productSelected", { n: chosen.length })}
      </p>
      <div className="csp-product-picker-list">
        {loading ? (
          <p className="admin-muted">…</p>
        ) : visible.length === 0 ? (
          <p className="admin-muted">{t("admin.servicePages.noProducts")}</p>
        ) : (
          visible.map((product) => {
            const selected = chosen.includes(product.id);
            const thumb = product.images?.[0];
            return (
              <button
                key={product.id}
                type="button"
                className={selected ? "csp-product-pick is-selected" : "csp-product-pick"}
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
                    {product.brand || product.category} · {formatPrice(product.sellingPrice)}
                  </small>
                </span>
                {selected ? <Check size={16} /> : null}
              </button>
            );
          })
        )}
      </div>
      <div className="admin-service-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {t("admin.servicePages.cancel")}
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={confirm}
          disabled={!chosen.length}
        >
          {t("admin.servicePages.attachSelected")}
        </button>
      </div>
    </AdminModal>
  );
}
