"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  Box,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  ImageIcon,
  Layers,
  Minus,
  Package,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import AdminProductCard from "@/components/admin/AdminProductCard";
import CatalogCategoriesModal from "@/components/admin/CatalogCategoriesModal";
import ProductCategoryMultiSelect from "@/components/admin/ProductCategoryMultiSelect";
import ProductImagesField from "@/components/admin/ProductImagesField";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import {
  categoryLabel,
  mergeCatalogCategories,
  productBelongsToCategory,
} from "@/lib/catalog-categories";
import { slugify } from "@/lib/format";
import type {
  AdminSession,
  CatalogCategory,
  Product,
  ProductCategory,
  ProductStatus,
} from "@/lib/types";

const CATEGORIES: ProductCategory[] = [
  "Prescription Glasses",
  "Sunglasses",
  "Contact Lenses",
  "Frames",
  "Accessories",
  "Cleaning Products",
];

const STATUSES: ProductStatus[] = ["active", "draft", "archived", "out_of_stock"];

const PAGE_BG = "#0B0E14";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const GOLD = "#D4AF37";
const MUTED = "#8A929C";

type ProductForm = {
  name: string;
  category: ProductCategory;
  categoryIds: string[];
  brand: string;
  frameType: string;
  lensType: string;
  barcode: string;
  sku: string;
  description: string;
  images: string[];
  purchasePrice: string;
  sellingPrice: string;
  stockQuantity: string;
  minimumStock: string;
  supplier: string;
  status: ProductStatus;
};

type EditorTab = "details" | "images";
type SortMode = "newest" | "name";
type SuccessKind = "add";

function usesLensType(category: ProductCategory): boolean {
  return (
    category === "Contact Lenses" ||
    category === "Prescription Glasses" ||
    category === "Sunglasses"
  );
}

const emptyForm = (): ProductForm => ({
  name: "",
  category: "Frames",
  categoryIds: [],
  brand: "",
  frameType: "",
  lensType: "",
  barcode: "",
  sku: "",
  description: "",
  images: [],
  purchasePrice: "0",
  sellingPrice: "0",
  stockQuantity: "0",
  minimumStock: "5",
  supplier: "",
  status: "active",
});

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

function parseWholeNonNeg(value: string, fallback: number): number {
  if (value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function toPayload(form: ProductForm, existing?: Product | null) {
  return {
    name: form.name,
    slug: slugify(form.name),
    category: form.category,
    categoryIds: form.categoryIds.filter((id) => id && id !== form.category),
    brand: form.brand || existing?.brand || "",
    frameType: form.frameType || existing?.frameType || undefined,
    lensType: usesLensType(form.category)
      ? form.lensType || existing?.lensType || undefined
      : existing?.lensType || undefined,
    barcode: form.barcode || existing?.barcode || undefined,
    sku: form.sku || existing?.sku || undefined,
    description: form.description,
    images: form.images.filter(Boolean),
    purchasePrice: Number(form.purchasePrice) || existing?.purchasePrice || 0,
    sellingPrice: parseWholeNonNeg(form.sellingPrice, 0),
    stockQuantity: parseWholeNonNeg(form.stockQuantity, 0),
    minimumStock: parseWholeNonNeg(
      form.minimumStock,
      existing?.minimumStock ?? 5,
    ),
    supplierId: form.supplier || existing?.supplierId || undefined,
    supplier: form.supplier || existing?.supplierId || undefined,
    status: form.status,
  };
}

function fromProduct(p: Product): ProductForm {
  return {
    name: p.name,
    category: p.category,
    categoryIds: (p.categoryIds || []).filter((id) => id && id !== p.category),
    brand: p.brand,
    frameType: p.frameType || "",
    lensType: p.lensType || "",
    barcode: p.barcode || "",
    sku: p.sku,
    description: p.description,
    images: [...(p.images || [])],
    purchasePrice: String(p.purchasePrice),
    sellingPrice: String(p.sellingPrice),
    stockQuantity: String(p.stockQuantity),
    minimumStock: String(p.minimumStock),
    supplier: p.supplierId || "",
    status: p.status,
  };
}

function statusLabel(status: ProductStatus): string {
  if (status === "active") return "نشط";
  if (status === "draft") return "مسودة";
  if (status === "archived") return "مؤرشف";
  if (status === "out_of_stock") return "غير متوفر";
  return status;
}

function typeLabel(
  categories: CatalogCategory[],
  id: string,
  locale: string,
  t: (path: string) => string,
): string {
  const found = categories.find((item) => item.id === id);
  if (found) return categoryLabel(found, locale);
  const key = `shop.categories.${id}`;
  const label = t(key);
  return label === key ? id : label;
}

const goldBtn: CSSProperties = {
  height: 48,
  borderRadius: 12,
  background: GOLD,
  color: "#0B0F14",
  border: "none",
  fontWeight: 700,
  fontSize: "0.9rem",
};

const outlineGoldBtn: CSSProperties = {
  height: 48,
  borderRadius: 12,
  background: "transparent",
  color: GOLD,
  border: `1px solid ${GOLD}`,
  fontWeight: 700,
  fontSize: "0.88rem",
};

const dangerOutlineBtn: CSSProperties = {
  height: 48,
  borderRadius: 12,
  background: "transparent",
  color: "#E07A7A",
  border: "1px solid rgba(224,122,122,0.55)",
  fontWeight: 700,
  fontSize: "0.88rem",
};


export default function AdminInventoryPage() {
  const { notifySaved } = useAdminSuccessNotice();
  const { t, locale } = useLocale();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(
    () => mergeCatalogCategories(undefined),
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("details");
  const [success, setSuccess] = useState<SuccessKind | null>(null);
  const [listPage, setListPage] = useState(1);
  const PAGE_SIZE = 16;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pData, me] = await Promise.all([
        apiFetch<unknown>("/api/products?all=1"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null,
        ),
      ]);
      setProducts(unwrapList<Product>(pData, ["products", "items", "data"]));
      if (pData && typeof pData === "object" && "catalogCategories" in pData) {
        setCatalogCategories(
          mergeCatalogCategories(
            (pData as { catalogCategories?: unknown }).catalogCategories,
          ),
        );
      }
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (category !== "all" && !productBelongsToCategory(p, category)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
      );
    });
    if (sortMode === "name") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }
    return list;
  }, [products, query, category, statusFilter, sortMode]);

  useEffect(() => {
    setListPage(1);
  }, [query, category, statusFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(listPage, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setTab("details");
    setSuccess(null);
    setMessage("");
    setEditorOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm(fromProduct(p));
    setTab("details");
    setSuccess(null);
    setMessage("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setTab("details");
    setSuccess(null);
  }

  function addAnotherProduct() {
    setEditing(null);
    setForm(emptyForm());
    setTab("details");
    setSuccess(null);
    setMessage("");
    setEditorOpen(true);
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!form.name.trim()) {
      setTab("details");
      setMessage("أدخل اسم المنتج");
      return;
    }
    setSaving(true);
    setMessage("");
    const payload = toPayload(form, editing);
    try {
      if (editing) {
        const updated = await apiFetch<Product | { product: Product }>(
          "/api/products",
          { method: "PUT", body: JSON.stringify({ id: editing.id, ...payload }) },
        );
        const row =
          updated && typeof updated === "object" && "product" in updated
            ? updated.product
            : (updated as Product);
        setProducts((prev) =>
          prev.map((p) => (p.id === editing.id ? { ...p, ...row } : p)),
        );
        setEditing({ ...editing, ...row });
        notifySaved();
      } else {
        const created = await apiFetch<Product | { product: Product }>(
          "/api/products",
          { method: "POST", body: JSON.stringify(payload) },
        );
        const row =
          created && typeof created === "object" && "product" in created
            ? created.product
            : (created as Product);
        setProducts((prev) => [row, ...prev]);
        setSuccess("add");
      }
    } catch (err) {
      setSuccess(null);
      setMessage(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function onDuplicate(p: Product) {
    setMessage("");
    try {
      const payload = {
        ...p,
        id: undefined,
        name: `${p.name} (Copy)`,
        sku: `${p.sku}-COPY`,
        slug: slugify(`${p.name}-copy-${Date.now()}`),
      };
      const created = await apiFetch<Product | { product: Product }>(
        "/api/products",
        { method: "POST", body: JSON.stringify(payload) },
      );
      const row =
        created && typeof created === "object" && "product" in created
          ? created.product
          : (created as Product);
      setProducts((prev) => [row, ...prev]);
      setMessage("تم نسخ المنتج");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل النسخ");
    }
  }

  async function onDelete(p: Product) {
    if (!hasPermission(role, "delete")) {
      setMessage("ليس لديك صلاحية الحذف");
      return;
    }
    if (!confirm(`حذف ${p.name}؟`)) return;
    try {
      await apiFetch(`/api/products?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      setMessage("تم حذف المنتج");
      if (editing?.id === p.id) closeEditor();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "فشل الحذف");
    }
  }

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pageWrap: CSSProperties = {
    margin: "-1.15rem",
    marginBottom: "calc(-1.5rem - env(safe-area-inset-bottom, 0px))",
    minHeight: "100%",
    background: PAGE_BG,
    padding: 16,
    paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
  };

  /* ───────────── Edit / Add page ───────────── */
  if (editorOpen) {
    const tabs: { id: EditorTab; label: string; icon: typeof Package }[] = [
      { id: "details", label: "بيانات المنتج", icon: Package },
      { id: "images", label: "الصور", icon: ImageIcon },
    ];
    const stockQty = Number(form.stockQuantity) || 0;
    const updatedLabel = editing?.updatedAt
      ? new Date(editing.updatedAt).toLocaleDateString("ar-EG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

    function goTab(next: EditorTab) {
      setTab(next);
    }

    const editorShell = (
      <div className="admin-pe-editor">
        <header className="admin-pe-header">
          <button
            type="button"
            onClick={closeEditor}
            aria-label="رجوع"
            className="admin-pe-back"
          >
            <ChevronRight size={18} strokeWidth={1.6} />
          </button>
          <div className="admin-pe-header-copy">
            <h1>{editing ? "تعديل المنتج" : "إضافة منتج"}</h1>
            <p>قم بتحديث بيانات المنتج</p>
          </div>
          <span className="admin-pe-mark" aria-hidden>
            <Box size={18} strokeWidth={1.55} />
          </span>
        </header>

        {message ? (
          <p
            className="mb-4 rounded-[12px] px-3 py-2 text-sm"
            style={{
              border: "1px solid rgba(224,122,122,0.35)",
              background: "rgba(224,122,122,0.12)",
              color: "var(--danger)",
            }}
          >
            {message}
          </p>
        ) : null}

            <div className="admin-pe-tabs" role="tablist">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`admin-pe-tab${tab === id ? " is-active" : ""}`}
                  onClick={() => setTab(id)}
                >
                  <Icon size={18} strokeWidth={1.7} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="flex flex-col gap-4"
            >
              {tab === "details" ? (
                <>
                  <div className="admin-pe-card">
                    <h2 className="admin-pe-card-title">
                      <Package size={16} strokeWidth={1.7} />
                      بيانات المنتج
                    </h2>
                    <div className="admin-pe-fields">
                    <div>
                      <label className="admin-pe-label" htmlFor="p-name">
                        <Tag size={13} strokeWidth={1.7} />
                        اسم المنتج
                      </label>
                      <div className="admin-pe-control">
                        <input
                          id="p-name"
                          className="admin-pe-input has-count"
                          value={form.name}
                          maxLength={100}
                          onChange={(e) => setField("name", e.target.value)}
                          required
                        />
                        <span className="admin-pe-count is-end">
                          {form.name.length}/100
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-category">
                        <Layers size={13} strokeWidth={1.7} />
                        {t("admin.catalog.productType")}
                      </label>
                      <select
                        id="p-category"
                        className="admin-pe-input"
                        value={form.category}
                        onChange={(e) => {
                          const next = e.target.value as ProductCategory;
                          setForm((prev) => ({
                            ...prev,
                            category: next,
                            categoryIds: prev.categoryIds.filter((id) => id !== next),
                          }));
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {typeLabel(catalogCategories, c, locale, t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="admin-pe-label">
                        <Layers size={13} strokeWidth={1.7} />
                        {t("admin.catalog.extraCategories")}
                      </label>
                      <ProductCategoryMultiSelect
                        categories={catalogCategories}
                        selectedIds={form.categoryIds}
                        excludeId={form.category}
                        locale={locale}
                        t={t}
                        onChange={(ids) => setField("categoryIds", ids)}
                      />
                    </div>
                    {usesLensType(form.category) ? (
                    <div>
                      <label className="admin-pe-label" htmlFor="p-lens">
                        <CircleDot size={13} strokeWidth={1.7} />
                        نوع العدسة
                      </label>
                      <input
                        id="p-lens"
                        className="admin-pe-input"
                        value={form.lensType}
                        onChange={(e) => setField("lensType", e.target.value)}
                      />
                    </div>
                    ) : null}
                    <div>
                      <label className="admin-pe-label" htmlFor="p-description">
                        <FileText size={13} strokeWidth={1.7} />
                        وصف المنتج
                      </label>
                      <div className="admin-pe-control">
                        <textarea
                          id="p-description"
                          className="admin-pe-input admin-pe-textarea"
                          value={form.description}
                          maxLength={300}
                          onChange={(e) => setField("description", e.target.value)}
                          required
                        />
                        <span className="admin-pe-count is-bottom">
                          {form.description.length}/300
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-selling">
                        <Wallet size={13} strokeWidth={1.7} />
                        سعر البيع (₪)
                      </label>
                      <input
                        id="p-selling"
                        type="number"
                        min="0"
                        step="1"
                        className="admin-pe-input"
                        value={form.sellingPrice}
                        onChange={(e) =>
                          setField("sellingPrice", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-stock">
                        <Package size={13} strokeWidth={1.7} />
                        الكمية المتوفرة
                      </label>
                      <div className="admin-pe-stepper">
                        <button
                          type="button"
                          aria-label="إنقاص"
                          className="admin-pe-stepper-btn"
                          onClick={() =>
                            setField(
                              "stockQuantity",
                              String(Math.max(0, stockQty - 1)),
                            )
                          }
                        >
                          <Minus size={15} strokeWidth={2} />
                        </button>
                        <input
                          id="p-stock"
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={form.stockQuantity}
                          onChange={(e) =>
                            setField("stockQuantity", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          aria-label="زيادة"
                          className="admin-pe-stepper-btn"
                          onClick={() =>
                            setField("stockQuantity", String(stockQty + 1))
                          }
                        >
                          <Plus size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-min">
                        الحد الأدنى للمخزون
                      </label>
                      <input
                        id="p-min"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className="admin-pe-input"
                        value={form.minimumStock}
                        onChange={(e) =>
                          setField("minimumStock", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-status">
                        حالة المنتج
                      </label>
                      <div className="admin-pe-status">
                        <span
                          className={
                            form.status === "active"
                              ? "admin-pe-status-dot is-active"
                              : "admin-pe-status-dot"
                          }
                        />
                        <select
                          id="p-status"
                          className="admin-pe-input"
                          value={form.status}
                          onChange={(e) =>
                            setField(
                              "status",
                              e.target.value as ProductStatus,
                            )
                          }
                        >
                          <option value="active">نشط</option>
                          <option value="draft">غير نشط</option>
                          <option value="archived">مؤرشف</option>
                          <option value="out_of_stock">غير متوفر</option>
                        </select>
                      </div>
                    </div>
                    <div className="admin-pe-meta">
                      <span
                        className={
                          form.status === "active"
                            ? "admin-pe-pill is-active"
                            : "admin-pe-pill"
                        }
                      >
                        {statusLabel(form.status)}
                      </span>
                      {updatedLabel ? (
                        <span className="admin-pe-meta-updated">
                          <Calendar size={13} strokeWidth={1.5} />
                          آخر تحديث: {updatedLabel}
                        </span>
                      ) : null}
                    </div>
                    </div>
                  </div>

                  <div className="admin-pe-step1-actions">
                    {hasPermission(role, "delete") && editing ? (
                      <button
                        type="button"
                        onClick={() => void onDelete(editing)}
                        className="flex items-center justify-center gap-1.5"
                        style={{
                          ...dangerOutlineBtn,
                          height: 42,
                          fontSize: "0.8rem",
                        }}
                      >
                        <Trash2 size={14} strokeWidth={1.55} />
                        حذف المنتج
                      </button>
                    ) : null}
                    {editing ? (
                      <button
                        type="button"
                        onClick={() => void onSubmit()}
                        disabled={saving}
                        className="flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{
                          ...outlineGoldBtn,
                          height: 42,
                          fontSize: "0.8rem",
                        }}
                      >
                        <Save size={14} strokeWidth={1.7} />
                        {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => goTab("images")}
                      disabled={saving}
                      className="flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{
                        ...goldBtn,
                        height: 42,
                        fontSize: "0.8rem",
                      }}
                    >
                      التالي
                      <ChevronLeft size={15} strokeWidth={2} />
                    </button>
                  </div>
                </>
              ) : null}

              {tab === "images" ? (
                <>
                  <div className="admin-pe-card">
                    <h2 className="admin-pe-card-title">
                      <ImageIcon size={16} strokeWidth={1.7} />
                      صور المنتج
                    </h2>
                    <p className="admin-pe-lead">يمكنك إضافة حتى 6 صور</p>
                    <ProductImagesField
                      images={form.images}
                      onChange={(images) => setField("images", images)}
                    />
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50"
                      style={goldBtn}
                    >
                      <Save size={16} strokeWidth={1.7} />
                      {saving
                        ? "جارٍ الحفظ…"
                        : editing
                          ? "حفظ التغييرات"
                          : "إضافة المنتج"}
                    </button>
                    <button
                      type="button"
                      onClick={() => goTab("details")}
                      className="flex flex-1 items-center justify-center gap-1.5"
                      style={outlineGoldBtn}
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                      السابق
                    </button>
                  </div>
                </>
              ) : null}
            </form>

        {success === "add" ? (
          <div
            className="admin-pe-success"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-pe-success-title"
          >
            <div className="admin-pe-success-card">
              <span className="admin-pe-success-check" aria-hidden>
                <Check size={22} strokeWidth={2.4} />
              </span>
              <h2 id="admin-pe-success-title">تم إضافة المنتج بنجاح</h2>
              <div className="admin-pe-success-actions">
                <button
                  type="button"
                  style={goldBtn}
                  onClick={addAnotherProduct}
                >
                  إضافة منتج آخر
                </button>
                <button
                  type="button"
                  style={outlineGoldBtn}
                  onClick={closeEditor}
                >
                  الانتقال إلى المنتجات
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );

    return <div style={pageWrap}>{editorShell}</div>;
  }

  /* ───────────── Products list ───────────── */
  return (
    <div style={{ ...pageWrap, overflowX: "hidden" }}>
      {/* Header — ONE cube icon */}
      <header className="admin-page-header mb-4 md:mb-5">
        <div className="admin-page-header-copy flex flex-col items-center text-center md:items-start md:text-start">
          <div className="admin-page-title-row">
            <h1 className="admin-page-title m-0 text-[1.45rem] font-semibold md:text-[1.65rem]">
              المنتجات
            </h1>
            <Box
              className="admin-page-title-icon"
              size={26}
              strokeWidth={1.45}
              aria-hidden
            />
          </div>
          <p className="admin-page-desc mb-0 mt-1.5 max-w-[28rem] text-[0.84rem] md:text-[0.88rem]">
            إدارة المنتجات والمخزون والأسعار والصور
          </p>
        </div>
      </header>

      {/* MOBILE toolbar */}
      <section className="admin-products-toolbar is-mobile">
        <div className="admin-products-toolbar-row">
          <button type="button" onClick={openCreate} className="admin-products-add">
            <Plus size={14} strokeWidth={1.7} />
            إضافة منتج
          </button>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="admin-products-manage"
          >
            {t("admin.catalog.manage")}
          </button>
          <span className="admin-products-count">
            <Package size={14} strokeWidth={1.55} />
            {filtered.length} منتج
          </span>
        </div>
        <div className="admin-products-toolbar-row">
          <label className="admin-products-ctrl">
            <Wallet size={14} strokeWidth={1.55} />
            <select
              className="admin-products-ctrl-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">{t("admin.catalog.allCategories")}</option>
              {catalogCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c, locale)}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-products-search-wrap">
            <Search size={14} strokeWidth={1.55} />
            <input
              className="admin-products-search"
              placeholder="ابحث…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              size={20}
            />
          </div>
        </div>
      </section>

      {/* DESKTOP toolbar */}
      <section className="admin-products-toolbar is-desktop">
        <button type="button" onClick={openCreate} className="admin-products-add">
          <Plus size={14} strokeWidth={1.7} />
          إضافة منتج
        </button>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="admin-products-manage"
        >
          {t("admin.catalog.manage")}
        </button>
        <span className="admin-products-count">
          <Package size={14} strokeWidth={1.55} />
          {filtered.length} منتج
        </span>
        <label className="admin-products-ctrl">
          <Calendar size={14} strokeWidth={1.55} />
          <select
            className="admin-products-ctrl-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="newest">الأحدث أولاً</option>
            <option value="name">حسب الاسم</option>
          </select>
        </label>
        <label className="admin-products-ctrl">
          <Package size={14} strokeWidth={1.55} />
          <select
            className="admin-products-ctrl-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-products-ctrl">
          <Wallet size={14} strokeWidth={1.55} />
          <select
            className="admin-products-ctrl-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">{t("admin.catalog.allCategories")}</option>
            {catalogCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c, locale)}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-products-search-wrap admin-products-toolbar-end">
          <Search size={14} strokeWidth={1.55} />
          <input
            className="admin-products-search"
            placeholder="ابحث بالاسم…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size={20}
          />
        </div>
      </section>

      {message ? (
        <p
          className="mb-4 rounded-[12px] px-3 py-2 text-sm"
          style={{
            background: "rgba(212,175,55,0.12)",
            border: "1px solid rgba(212,175,55,0.35)",
            color: GOLD,
          }}
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="mb-4 rounded-[12px] px-3 py-2 text-sm"
          style={{
            border: "1px solid rgba(224,122,122,0.35)",
            background: "rgba(224,122,122,0.12)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: MUTED }}>جارٍ التحميل…</p>
      ) : filtered.length === 0 ? (
        <div
          className="px-4 py-8 text-center"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            color: MUTED,
          }}
        >
          لا توجد منتجات
        </div>
      ) : (
        <>
          <div className="admin-products-grid">
            {paged.map((p) => (
              <AdminProductCard
                key={p.id}
                product={p}
                categoryLabels={[
                  typeLabel(catalogCategories, p.category, locale, t),
                  ...((p.categoryIds || [])
                    .filter((id) => id !== p.category)
                    .map((id) => typeLabel(catalogCategories, id, locale, t))),
                ]}
                canDelete={hasPermission(role, "delete")}
                onEdit={() => openEdit(p)}
                onDelete={() => void onDelete(p)}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-5 flex flex-col items-center gap-3 pb-1 md:flex-row md:flex-wrap md:justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="السابق"
                  disabled={safePage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  className="grid place-items-center rounded-[9px] disabled:opacity-35"
                  style={{
                    width: 34,
                    height: 34,
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    color: "#FFFFFF",
                  }}
                >
                  <ChevronRight size={14} strokeWidth={1.6} />
                </button>
                {(() => {
                  const windowSize = Math.min(5, totalPages);
                  let start = Math.max(1, safePage - Math.floor(windowSize / 2));
                  const end = Math.min(totalPages, start + windowSize - 1);
                  start = Math.max(1, end - windowSize + 1);
                  const pages: number[] = [];
                  for (let p = start; p <= end; p += 1) pages.push(p);
                  return pages.map((page) => {
                    const active = page === safePage;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setListPage(page)}
                        className="grid place-items-center rounded-[8px] text-[0.78rem] font-bold"
                        style={{
                          width: 32,
                          height: 32,
                          background: active ? GOLD : CARD_BG,
                          border: active
                            ? `1px solid ${GOLD}`
                            : `1px solid ${BORDER}`,
                          color: active ? "#0B0E14" : MUTED,
                        }}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}
                <button
                  type="button"
                  aria-label="التالي"
                  disabled={safePage >= totalPages}
                  onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                  className="grid place-items-center rounded-[9px] disabled:opacity-35"
                  style={{
                    width: 34,
                    height: 34,
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    color: "#FFFFFF",
                  }}
                >
                  <ChevronLeft size={14} strokeWidth={1.6} />
                </button>
              </div>
              <div
                className="flex w-full items-center justify-center rounded-[11px] px-3 text-[0.8rem] font-semibold md:w-auto md:justify-start"
                style={{
                  height: 40,
                  color: GOLD,
                  border: `1px solid rgba(212,175,55,0.65)`,
                  background: "transparent",
                }}
                aria-label={`${PAGE_SIZE} لكل صفحة`}
              >
                {PAGE_SIZE} لكل صفحة
              </div>
            </div>
          ) : null}
        </>
      )}
      <CatalogCategoriesModal
        open={manageOpen}
        locale={locale}
        t={t}
        products={products}
        categories={catalogCategories}
        onClose={() => setManageOpen(false)}
        onChange={setCatalogCategories}
        onProductsChange={() => void load()}
      />
    </div>
  );
}
