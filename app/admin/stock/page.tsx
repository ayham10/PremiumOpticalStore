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
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Package,
  PackageX,
  Pencil,
  Search,
  Warehouse,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { formatPrice } from "@/lib/format";
import { formatFrameSizePublic } from "@/lib/product-fields";
import { productDisplayImage } from "@/lib/product-images";
import { productSearchText, resolveProductCopy } from "@/lib/product-i18n";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import type { StockExportLabels } from "@/lib/stock-export";
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

const PAGE_SIZE = 10;

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

function productNumber(product: Product): string {
  const sku = product.sku?.trim();
  return sku || "—";
}

function productColorText(product: Product, locale: Locale): string {
  const copy = resolveProductCopy(product, locale);
  const color = copy.color?.trim() || product.color?.trim();
  return color || "—";
}

function lensSizeDisplay(product: Product): string {
  const formatted = formatFrameSizePublic(product.frameSize);
  return formatted || "—";
}

function matchesStockSearch(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const number = product.sku?.trim().toLowerCase() ?? "";
  if (number.includes(q)) return true;
  if (product.name.toLowerCase().includes(q)) return true;
  return productSearchText(product).includes(q);
}

function parseWholeNonNegative(value: string): number | null {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) return null;
  return qty;
}

export default function AdminStockPage() {
  const { notifySaved } = useAdminSuccessNotice();
  const { t, locale } = useLocale();
  const defaults = useCategoryDefaultImages();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StockLevel>("all");
  const [sortKey, setSortKey] = useState<SortKey>("stock");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [listPage, setListPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [minStockQty, setMinStockQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

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

  const filteredRows = useMemo(() => {
    const filtered = products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      const level = getStockLevel(product.stockQuantity, product.minimumStock);
      if (statusFilter !== "all" && level !== statusFilter) return false;
      return matchesStockSearch(product, query);
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, listPage), totalPages);

  useEffect(() => {
    setListPage(1);
  }, [query, category, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    setListPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  const pageFrom =
    filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageTo = Math.min(safePage * PAGE_SIZE, filteredRows.length);

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
    setStockQty(String(productStockQuantity(product.stockQuantity)));
    setMinStockQty(String(Math.max(0, Math.floor(product.minimumStock ?? 0))));
    setMessage("");
  }

  async function onSaveStock(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const qty = parseWholeNonNegative(stockQty);
    const min = parseWholeNonNegative(minStockQty);
    if (qty === null) {
      setMessage(t("admin.stock.invalidQty"));
      return;
    }
    if (min === null) {
      setMessage(t("admin.stock.invalidMinQty"));
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiFetch<Product | { product: Product }>(
        "/api/products",
        {
          method: "PUT",
          body: JSON.stringify({
            id: editing.id,
            stockQuantity: qty,
            minimumStock: min,
          }),
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
      notifySaved();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.stock.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  function exportLabels(): StockExportLabels {
    const stamp = new Date().toISOString().slice(0, 10);
    const base = t("admin.stock.exportFilename");
    return {
      titleAr: t("admin.stock.reportTitleAr"),
      titleEn: t("admin.stock.reportTitleEn"),
      reportDate: t("admin.stock.reportDate"),
      totalQty: t("admin.stock.totalQty"),
      inStock: t("admin.stock.inStock"),
      lowStock: t("admin.stock.lowStock"),
      outOfStock: t("admin.stock.outOfStock"),
      colImage: t("admin.stock.colImage"),
      colName: t("admin.stock.colName"),
      colNumber: t("admin.stock.colSku"),
      colCategory: t("admin.stock.colCategory"),
      colColor: t("admin.stock.colColor"),
      colSize: t("admin.stock.colLensSize"),
      colPrice: t("admin.stock.colPrice"),
      colStock: t("admin.stock.colStock"),
      colMin: t("admin.stock.colMinShort"),
      colRequired: t("admin.stock.colRequired"),
      colStatus: t("admin.stock.colStatus"),
      statusIn: t("admin.stock.statusIn"),
      statusLow: t("admin.stock.statusLow"),
      statusOut: t("admin.stock.statusOut"),
      empty: t("admin.stock.empty"),
      website: "www.oyonoptics.com",
      location: t("admin.stock.locationFooter"),
      sheetName: t("admin.stock.sheetName"),
      pdfFilename: `${base}-${stamp}.pdf`,
      xlsxFilename: `${base}-${stamp}.xlsx`,
    };
  }

  async function exportReport(kind: "pdf" | "xlsx") {
    if (exporting || filteredRows.length === 0) return;
    setExporting(kind);
    setMessage("");
    try {
      const { downloadStockReportPdf, downloadStockReportXlsx } = await import(
        "@/lib/stock-report-download"
      );
      const payload = {
        products: filteredRows,
        locale,
        labels: exportLabels(),
        categoryLabel,
        statusLabel,
        defaults,
      };
      if (kind === "pdf") await downloadStockReportPdf(payload);
      else await downloadStockReportXlsx(payload);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.stock.exportError"),
      );
    } finally {
      setExporting(null);
    }
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

  const tableColSpan = 9;

  return (
    <div className="admin-stock-page">
      <AdminPageHeader
        icon={Warehouse}
        kicker={t("admin.stock.kicker")}
        title={t("admin.stock.title")}
        description={t("admin.stock.description")}
        actions={
          <div className="admin-stock-export-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void exportReport("pdf")}
              disabled={loading || filteredRows.length === 0 || Boolean(exporting)}
            >
              <FileText size={16} />
              {exporting === "pdf"
                ? t("admin.stock.exporting")
                : t("admin.stock.exportPdf")}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void exportReport("xlsx")}
              disabled={loading || filteredRows.length === 0 || Boolean(exporting)}
            >
              <FileSpreadsheet size={16} />
              {exporting === "xlsx"
                ? t("admin.stock.exporting")
                : t("admin.stock.exportExcel")}
            </button>
          </div>
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
        <p className="admin-stock-inline-msg is-warn">{message}</p>
      ) : null}
      {error ? (
        <p className="admin-stock-inline-msg is-error">{error}</p>
      ) : null}

      <p className="admin-stock-count">
        {t("admin.stock.showing", {
          from: pageFrom,
          to: pageTo,
          filtered: filteredRows.length,
        })}{" "}
        <span className="admin-muted">
          {t("admin.stock.showingTotal", { total: products.length })}
        </span>
      </p>

      <div className="admin-card admin-stock-table-wrap overflow-hidden">
        <div className="md:overflow-x-auto">
          <table className="table admin-stock-table">
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
                <th>{t("admin.stock.colColor")}</th>
                <th>{t("admin.stock.colLensSize")}</th>
                <th>{t("admin.stock.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-[var(--slate)]">
                    {t("admin.stock.loading")}
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-[var(--slate)]">
                    {t("admin.stock.empty")}
                  </td>
                </tr>
              ) : (
                pageRows.map((product) => {
                  const level = getStockLevel(
                    product.stockQuantity,
                    product.minimumStock,
                  );
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
                        <div className="admin-stock-product-number">
                          {productNumber(product)}
                        </div>
                      </td>
                      <td className="admin-stock-category">
                        {categoryLabel(product.category)}
                      </td>
                      <td>{formatPrice(product.sellingPrice)}</td>
                      <td className="admin-stock-qty">
                        {productStockQuantity(product.stockQuantity)}
                      </td>
                      <td>
                        <span className={`admin-stock-badge is-${level}`}>
                          {statusLabel(level)}
                        </span>
                      </td>
                      <td className="admin-stock-color">
                        {productColorText(product, locale)}
                      </td>
                      <td className="admin-stock-lens-size">
                        {lensSizeDisplay(product)}
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

      <div className="admin-stock-mobile">
        {loading ? (
          <p className="admin-muted">{t("admin.stock.loading")}</p>
        ) : pageRows.length === 0 ? (
          <p className="admin-muted">{t("admin.stock.empty")}</p>
        ) : (
          pageRows.map((product) => {
            const level = getStockLevel(
              product.stockQuantity,
              product.minimumStock,
            );
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
                    <div>
                      <h2>{product.name}</h2>
                      <p className="admin-stock-product-number">
                        {productNumber(product)}
                      </p>
                    </div>
                    <span className={`admin-stock-badge is-${level}`}>
                      {statusLabel(level)}
                    </span>
                  </div>
                  <p>{categoryLabel(product.category)}</p>
                  <p>
                    {formatPrice(product.sellingPrice)} ·{" "}
                    {t("admin.stock.colStock")}:{" "}
                    {productStockQuantity(product.stockQuantity)}
                  </p>
                  <p>
                    {t("admin.stock.colColor")}: {productColorText(product, locale)}
                  </p>
                  <p>
                    {t("admin.stock.colLensSize")}: {lensSizeDisplay(product)}
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

      {!loading && filteredRows.length > 0 ? (
        <div className="admin-stock-pagination">
          <button
            type="button"
            className="admin-stock-page-btn"
            aria-label={t("admin.stock.pagePrev")}
            disabled={safePage <= 1}
            onClick={() => setListPage((p) => Math.max(1, p - 1))}
          >
            <ChevronRight size={16} />
          </button>
          <div className="admin-stock-page-list">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => {
                const active = page === safePage;
                return (
                  <button
                    key={page}
                    type="button"
                    className={`admin-stock-page-num${active ? " is-active" : ""}`}
                    onClick={() => setListPage(page)}
                    aria-current={active ? "page" : undefined}
                  >
                    {page}
                  </button>
                );
              },
            )}
          </div>
          <button
            type="button"
            className="admin-stock-page-btn"
            aria-label={t("admin.stock.pageNext")}
            disabled={safePage >= totalPages}
            onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="admin-stock-per-page">{t("admin.stock.perPage")}</span>
        </div>
      ) : null}

      <AdminModal
        open={Boolean(editing)}
        title={t("admin.stock.editTitle")}
        onClose={() => setEditing(null)}
        icon={<Warehouse size={18} />}
        compact
      >
        {editing ? (
          <form onSubmit={onSaveStock} className="admin-stock-edit">
            <div className="admin-stock-edit-head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productDisplayImage(editing, defaults)}
                alt=""
                className="admin-stock-thumb is-lg"
              />
              <div className="admin-stock-edit-meta">
                <div>
                  <span className="label">{t("admin.stock.productName")}</span>
                  <p className="admin-stock-edit-value">{editing.name}</p>
                </div>
                <div>
                  <span className="label">{t("admin.stock.productNumber")}</span>
                  <p className="admin-stock-edit-value">{productNumber(editing)}</p>
                </div>
                <div>
                  <span className="label">{t("admin.stock.colorLabel")}</span>
                  <p className="admin-stock-edit-value">
                    {productColorText(editing, locale)}
                  </p>
                </div>
              </div>
            </div>
            <div className="admin-stock-edit-fields">
              <label>
                <span className="label">{t("admin.stock.currentStock")}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={stockQty}
                  onChange={(event) => setStockQty(event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="label">{t("admin.stock.minimumStock")}</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={minStockQty}
                  onChange={(event) => setMinStockQty(event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="admin-stock-edit-actions">
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
