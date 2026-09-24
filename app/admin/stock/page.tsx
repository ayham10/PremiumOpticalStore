"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Download,
  Package,
  PackageX,
  Pencil,
  Search,
  Warehouse,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { formatPrice } from "@/lib/format";
import { productDisplayImage } from "@/lib/product-images";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import {
  getStockLevel,
  productStockQuantity,
  type StockLevel,
} from "@/lib/stock-status";
import type { AdminSession, Product, ProductCategory } from "@/lib/types";
import { useCategoryDefaultImages } from "@/lib/use-category-default-images";
import type { Locale } from "@/lib/i18n/config";

const CATEGORIES: ProductCategory[] = [
  "Prescription Glasses",
  "Sunglasses",
  "Contact Lenses",
  "Frames",
  "Accessories",
  "Cleaning Products",
];

type SortKey = "stock" | "name" | "price" | "updated";
type SortDir = "asc" | "desc";

function unwrapList<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function formatUpdatedAt(value: string | undefined, locale: Locale): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tag = locale === "ar" ? "ar" : locale === "he" ? "he" : "en-GB";
  return date.toLocaleString(tag, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export default function AdminStockPage() {
  const { t, locale } = useLocale();
  const defaults = useCategoryDefaultImages();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StockLevel>("all");
  const [sortKey, setSortKey] = useState<SortKey>("stock");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [newQty, setNewQty] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await apiFetch<{ user: AdminSession } | AdminSession>(
        "/api/auth/me",
      ).catch(() => null);
      if (me) {
        const user = "user" in me ? me.user : me;
        if (!hasPermission(user.role, "inventory")) {
          setError(t("admin.stock.loadError"));
          setProducts([]);
          return;
        }
      }
      const data = await apiFetch<unknown>("/api/products?all=1");
      setProducts(unwrapList<Product>(data, ["products", "items", "data"]));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.stock.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let totalQty = 0;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const product of products) {
      const qty = productStockQuantity(product.stockQuantity);
      totalQty += qty;
      const level = getStockLevel(product.stockQuantity, product.minimumStock);
      if (level === "in") inStock += 1;
      else if (level === "low") lowStock += 1;
      else outOfStock += 1;
    }
    return { totalQty, inStock, lowStock, outOfStock };
  }, [products]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      const level = getStockLevel(product.stockQuantity, product.minimumStock);
      if (statusFilter !== "all" && level !== statusFilter) return false;
      if (!q) return true;
      return [product.name, product.sku, product.barcode]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });

    const localeTag = locale === "ar" ? "ar" : locale === "he" ? "he" : "en";
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "stock") {
        return (
          (productStockQuantity(a.stockQuantity) -
            productStockQuantity(b.stockQuantity)) *
          dir
        );
      }
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, localeTag) * dir;
      }
      if (sortKey === "price") {
        return ((a.sellingPrice || 0) - (b.sellingPrice || 0)) * dir;
      }
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      const aSafe = Number.isFinite(aTime) ? aTime : 0;
      const bSafe = Number.isFinite(bTime) ? bTime : 0;
      return (aSafe - bSafe) * dir;
    });
  }, [products, query, category, statusFilter, sortKey, sortDir, locale]);

  function statusLabel(level: StockLevel): string {
    if (level === "in") return t("admin.stock.statusIn");
    if (level === "low") return t("admin.stock.statusLow");
    return t("admin.stock.statusOut");
  }

  function categoryLabel(value: string): string {
    const key = `shop.categories.${value}`;
    const label = t(key);
    return label === key ? value : label;
  }

  function toggleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir(next === "updated" ? "desc" : "asc");
  }

  function openEdit(product: Product) {
    setEditing(product);
    setNewQty(String(productStockQuantity(product.stockQuantity)));
    setMessage("");
  }

  async function onSaveStock(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const qty = Number(newQty);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      setMessage(t("admin.stock.invalidQty"));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiFetch<Product | { product: Product }>(
        "/api/products",
        {
          method: "PUT",
          body: JSON.stringify({ id: editing.id, stockQuantity: qty }),
        },
      );
      const row =
        updated && typeof updated === "object" && "product" in updated
          ? updated.product
          : (updated as Product);
      setProducts((prev) =>
        prev.map((product) =>
          product.id === editing.id ? { ...product, ...row } : product,
        ),
      );
      invalidatePublicCache("product:");
      invalidatePublicCache("products:");
      setEditing(null);
      setMessage(t("admin.stock.saved"));
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.stock.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const header = [
      t("admin.stock.colName"),
      t("admin.stock.colSku"),
      t("admin.stock.colCategory"),
      t("admin.stock.colPrice"),
      t("admin.stock.colStock"),
      t("admin.stock.colStatus"),
    ];
    const lines = [
      header.map(csvCell).join(","),
      ...rows.map((product) => {
        const level = getStockLevel(
          product.stockQuantity,
          product.minimumStock,
        );
        return [
          product.name,
          product.sku,
          categoryLabel(product.category),
          product.sellingPrice,
          productStockQuantity(product.stockQuantity),
          statusLabel(level),
        ]
          .map(csvCell)
          .join(",");
      }),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${t("admin.stock.exportFilename")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = [
    {
      key: "total",
      label: t("admin.stock.totalQty"),
      value: summary.totalQty,
      icon: Package,
      tone: "gold",
    },
    {
      key: "in",
      label: t("admin.stock.inStock"),
      value: summary.inStock,
      icon: CheckCircle2,
      tone: "green",
    },
    {
      key: "low",
      label: t("admin.stock.lowStock"),
      value: summary.lowStock,
      icon: AlertTriangle,
      tone: "amber",
    },
    {
      key: "out",
      label: t("admin.stock.outOfStock"),
      value: summary.outOfStock,
      icon: PackageX,
      tone: "red",
    },
  ] as const;

  return (
    <div className="admin-stock-page space-y-5">
      <AdminPageHeader
        icon={Warehouse}
        kicker={t("admin.stock.kicker")}
        title={t("admin.stock.title")}
        description={t("admin.stock.description")}
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportCsv}
            disabled={loading || rows.length === 0}
          >
            <Download size={16} />
            {t("admin.stock.exportCsv")}
          </button>
        }
      />

      <div className="admin-stock-summary">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.key}
              className={`admin-card admin-stock-card is-${card.tone}`}
            >
              <div>
                <p className="admin-card-label">{card.label}</p>
                <p className="admin-card-value">{loading ? "—" : card.value}</p>
              </div>
              <span className="admin-stock-card-icon">
                <Icon size={18} strokeWidth={1.6} />
              </span>
            </article>
          );
        })}
      </div>

      <div className="admin-card admin-stock-toolbar">
        <label className="admin-stock-search">
          <Search size={16} />
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.stock.searchPlaceholder")}
            aria-label={t("admin.stock.search")}
          />
        </label>
        <label className="admin-filter-chip">
          <span className="admin-filter-chip-label">
            {t("admin.stock.category")}
          </span>
          <select
            className="admin-filter-chip-control"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">{t("admin.stock.allCategories")}</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-filter-chip">
          <span className="admin-filter-chip-label">
            {t("admin.stock.status")}
          </span>
          <select
            className="admin-filter-chip-control"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | StockLevel)
            }
          >
            <option value="all">{t("admin.stock.allStatuses")}</option>
            <option value="in">{t("admin.stock.statusIn")}</option>
            <option value="low">{t("admin.stock.statusLow")}</option>
            <option value="out">{t("admin.stock.statusOut")}</option>
          </select>
        </label>
        <label className="admin-filter-chip">
          <span className="admin-filter-chip-label">{t("admin.stock.sort")}</span>
          <select
            className="admin-filter-chip-control"
            value={`${sortKey}-${sortDir}`}
            onChange={(event) => {
              const [key, dir] = event.target.value.split("-") as [
                SortKey,
                SortDir,
              ];
              setSortKey(key);
              setSortDir(dir);
            }}
          >
            <option value="stock-asc">{t("admin.stock.sortStockAsc")}</option>
            <option value="stock-desc">{t("admin.stock.sortStockDesc")}</option>
            <option value="name-asc">{t("admin.stock.sortNameAsc")}</option>
            <option value="name-desc">{t("admin.stock.sortNameDesc")}</option>
            <option value="price-asc">{t("admin.stock.sortPriceAsc")}</option>
            <option value="price-desc">{t("admin.stock.sortPriceDesc")}</option>
            <option value="updated-desc">
              {t("admin.stock.sortUpdatedDesc")}
            </option>
            <option value="updated-asc">
              {t("admin.stock.sortUpdatedAsc")}
            </option>
          </select>
        </label>
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <p className="admin-stock-count">
        {t("admin.stock.showing", {
          shown: rows.length,
          total: products.length,
        })}
      </p>

      <div className="admin-card admin-stock-table-wrap hidden overflow-hidden md:block">
        <div className="md:overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("admin.stock.colImage")}</th>
                <th>
                  <button
                    type="button"
                    className="admin-stock-th-sort"
                    onClick={() => toggleSort("name")}
                  >
                    {t("admin.stock.colName")}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
                <th>{t("admin.stock.colSku")}</th>
                <th>{t("admin.stock.colCategory")}</th>
                <th>
                  <button
                    type="button"
                    className="admin-stock-th-sort"
                    onClick={() => toggleSort("price")}
                  >
                    {t("admin.stock.colPrice")}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="admin-stock-th-sort"
                    onClick={() => toggleSort("stock")}
                  >
                    {t("admin.stock.colStock")}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
                <th>{t("admin.stock.colStatus")}</th>
                <th>
                  <button
                    type="button"
                    className="admin-stock-th-sort"
                    onClick={() => toggleSort("updated")}
                  >
                    {t("admin.stock.colUpdated")}
                    <ArrowUpDown size={13} />
                  </button>
                </th>
                <th>{t("admin.stock.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-[var(--slate)]">
                    {t("admin.stock.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-[var(--slate)]">
                    {t("admin.stock.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((product) => {
                  const level = getStockLevel(
                    product.stockQuantity,
                    product.minimumStock,
                  );
                  const updated = formatUpdatedAt(product.updatedAt, locale);
                  return (
                    <tr key={product.id}>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={productDisplayImage(product, defaults)}
                          alt=""
                          className="admin-stock-thumb"
                        />
                      </td>
                      <td>
                        <div className="admin-cell-primary">{product.name}</div>
                      </td>
                      <td className="admin-muted">{product.sku || "—"}</td>
                      <td>{categoryLabel(product.category)}</td>
                      <td>{formatPrice(product.sellingPrice)}</td>
                      <td className="admin-stock-qty">
                        {productStockQuantity(product.stockQuantity)}
                      </td>
                      <td>
                        <span className={`admin-stock-badge is-${level}`}>
                          {statusLabel(level)}
                        </span>
                      </td>
                      <td className="admin-muted text-sm">
                        {updated || t("admin.stock.unknownDate")}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                          onClick={() => openEdit(product)}
                        >
                          <Pencil size={14} />
                          {t("admin.stock.edit")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-stock-mobile md:hidden">
        {loading ? (
          <p className="admin-muted">{t("admin.stock.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="admin-muted">{t("admin.stock.empty")}</p>
        ) : (
          rows.map((product) => {
            const level = getStockLevel(
              product.stockQuantity,
              product.minimumStock,
            );
            const updated = formatUpdatedAt(product.updatedAt, locale);
            return (
              <article key={product.id} className="admin-card admin-stock-mobile-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productDisplayImage(product, defaults)}
                  alt=""
                  className="admin-stock-thumb"
                />
                <div className="admin-stock-mobile-body">
                  <div className="admin-stock-mobile-top">
                    <h2>{product.name}</h2>
                    <span className={`admin-stock-badge is-${level}`}>
                      {statusLabel(level)}
                    </span>
                  </div>
                  <p>
                    {product.sku || "—"} · {categoryLabel(product.category)}
                  </p>
                  <p>
                    {formatPrice(product.sellingPrice)} ·{" "}
                    {t("admin.stock.colStock")}:{" "}
                    {productStockQuantity(product.stockQuantity)}
                  </p>
                  <p className="admin-muted">
                    {updated || t("admin.stock.unknownDate")}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                    onClick={() => openEdit(product)}
                  >
                    <Pencil size={14} />
                    {t("admin.stock.edit")}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <AdminModal
        open={Boolean(editing)}
        title={t("admin.stock.editTitle")}
        onClose={() => setEditing(null)}
        icon={<Warehouse size={18} />}
      >
        {editing ? (
          <form onSubmit={onSaveStock} className="admin-stock-edit">
            <div className="admin-stock-edit-product">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productDisplayImage(editing, defaults)}
                alt=""
                className="admin-stock-thumb is-lg"
              />
              <div>
                <h3>{editing.name}</h3>
                <p>{editing.sku || "—"}</p>
              </div>
            </div>
            <p className="admin-stock-current">
              {t("admin.stock.currentStock")}:{" "}
              <strong>
                {productStockQuantity(editing.stockQuantity)}
              </strong>
            </p>
            <label>
              <span className="label">{t("admin.stock.newStock")}</span>
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={newQty}
                onChange={(event) => setNewQty(event.target.value)}
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
              >
                {t("admin.stock.cancel")}
              </button>
              <button type="submit" className="btn btn-accent" disabled={saving}>
                {saving ? t("admin.stock.saving") : t("admin.stock.save")}
              </button>
            </div>
          </form>
        ) : null}
      </AdminModal>
    </div>
  );
}
