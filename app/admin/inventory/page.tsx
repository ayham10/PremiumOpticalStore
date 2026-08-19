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
  ArrowRight,
  Barcode,
  Box,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  Glasses,
  Hash,
  ImageIcon,
  Layers,
  Minus,
  Package,
  Plus,
  Save,
  Search,
  Star,
  Tag,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import AdminProductCard from "@/components/admin/AdminProductCard";
import ProductImagesField from "@/components/admin/ProductImagesField";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { slugify } from "@/lib/format";
import type {
  AdminSession,
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

type EditorTab = "details" | "images" | "stock";
type SortMode = "newest" | "name";

const emptyForm = (): ProductForm => ({
  name: "",
  category: "Frames",
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

function toPayload(form: ProductForm) {
  return {
    name: form.name,
    slug: slugify(form.name),
    category: form.category,
    brand: form.brand,
    frameType: form.frameType || undefined,
    lensType: form.lensType || undefined,
    barcode: form.barcode || undefined,
    sku: form.sku,
    description: form.description,
    images: form.images.filter(Boolean),
    purchasePrice: Number(form.purchasePrice) || 0,
    sellingPrice: Number(form.sellingPrice) || 0,
    stockQuantity: Number(form.stockQuantity) || 0,
    minimumStock: Number(form.minimumStock) || 0,
    supplierId: form.supplier || undefined,
    supplier: form.supplier || undefined,
    status: form.status,
  };
}

function fromProduct(p: Product): ProductForm {
  return {
    name: p.name,
    category: p.category,
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

const editorCard: CSSProperties = {
  background: CARD_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 16,
};

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
  const [products, setProducts] = useState<Product[]>([]);
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
  const [tab, setTab] = useState<EditorTab | "overview">("overview");
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
      if (category !== "all" && p.category !== category) return false;
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
    setEditorOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm(fromProduct(p));
    setTab("overview");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
    setTab("overview");
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = toPayload(form);
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
        setMessage("تم حفظ المنتج");
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
        setMessage("تمت إضافة المنتج");
        setEditorOpen(false);
      }
    } catch (err) {
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
    const thumb = form.images[0];
    const tabs: { id: EditorTab; label: string; icon: typeof Package }[] = [
      { id: "details", label: "بيانات المنتج", icon: Package },
      { id: "images", label: "الصور", icon: ImageIcon },
      { id: "stock", label: "المخزون والسعر", icon: Wallet },
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
            onClick={() => {
              if (editing && tab !== "overview") setTab("overview");
              else closeEditor();
            }}
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
              background: "rgba(212,175,106,0.12)",
              border: "1px solid rgba(212,175,106,0.35)",
              color: GOLD,
            }}
          >
            {message}
          </p>
        ) : null}

        {editing && tab === "overview" ? (
          <div className="space-y-4">
            <section
              className="flex gap-3"
              style={{
                ...editorCard,
                padding: 12,
              }}
            >
              <div
                className="shrink-0 overflow-hidden"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 12,
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2
                    className="m-0 text-[1rem] font-semibold leading-snug"
                    style={{ color: "#FFFFFF" }}
                  >
                    {form.name || "—"}
                  </h2>
                  {form.status === "active" ? (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold"
                      style={{
                        background: "rgba(94,196,154,0.16)",
                        color: "#5EC49A",
                      }}
                    >
                      نشط
                    </span>
                  ) : null}
                </div>
                <p className="mb-0 mt-1 text-[0.8rem]" style={{ color: MUTED }}>
                  {[form.brand, form.category].filter(Boolean).join(" • ")}
                </p>
                <span
                  className="mt-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem]"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: MUTED,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  {form.sku || "SKU"}
                </span>
              </div>
            </section>

            <div className="space-y-3">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="flex w-full items-center gap-3 text-start"
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                    padding: "14px 14px",
                    minHeight: 64,
                  }}
                >
                  <span
                    className="grid place-items-center rounded-[10px]"
                    style={{
                      width: 36,
                      height: 36,
                      background: "rgba(212,175,106,0.08)",
                      border: "1px solid rgba(212,175,106,0.3)",
                      color: GOLD,
                    }}
                  >
                    <Icon size={17} strokeWidth={1.55} />
                  </span>
                  <span className="flex-1 text-[0.92rem] font-semibold" style={{ color: "#FFFFFF" }}>
                    {label}
                  </span>
                  <ArrowRight size={16} strokeWidth={1.55} color={MUTED} />
                </button>
              ))}
            </div>

            {hasPermission(role, "delete") && editing ? (
              <button
                type="button"
                onClick={() => void onDelete(editing)}
                className="mt-2 flex w-full items-center justify-center gap-2"
                style={dangerOutlineBtn}
              >
                <Trash2 size={16} strokeWidth={1.55} />
                حذف المنتج
              </button>
            ) : null}
          </div>
        ) : (
          <>
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
                        الفئة
                      </label>
                      <select
                        id="p-category"
                        className="admin-pe-input"
                        value={form.category}
                        onChange={(e) =>
                          setField("category", e.target.value as ProductCategory)
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-brand">
                        <Star size={13} strokeWidth={1.7} />
                        العلامة التجارية
                      </label>
                      <input
                        id="p-brand"
                        className="admin-pe-input"
                        value={form.brand}
                        onChange={(e) => setField("brand", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-frame">
                        <Glasses size={13} strokeWidth={1.7} />
                        نوع الإطار
                      </label>
                      <input
                        id="p-frame"
                        className="admin-pe-input"
                        value={form.frameType}
                        onChange={(e) => setField("frameType", e.target.value)}
                      />
                    </div>
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
                    <div className="admin-pe-pair">
                      <div>
                        <label className="admin-pe-label" htmlFor="p-sku">
                          <Hash size={13} strokeWidth={1.7} />
                          SKU
                        </label>
                        <input
                          id="p-sku"
                          className="admin-pe-input"
                          value={form.sku}
                          onChange={(e) => setField("sku", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="admin-pe-label" htmlFor="p-barcode">
                          <Barcode size={13} strokeWidth={1.7} />
                          الباركود
                        </label>
                        <div className="admin-pe-control">
                          <input
                            id="p-barcode"
                            className="admin-pe-input has-end-icon"
                            value={form.barcode}
                            onChange={(e) => setField("barcode", e.target.value)}
                          />
                          <span className="admin-pe-end-icon">
                            <Barcode size={15} strokeWidth={1.5} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="admin-pe-label" htmlFor="p-supplier">
                        <Truck size={13} strokeWidth={1.7} />
                        المورد
                      </label>
                      <input
                        id="p-supplier"
                        className="admin-pe-input"
                        value={form.supplier}
                        onChange={(e) => setField("supplier", e.target.value)}
                      />
                    </div>
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

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => goTab("images")}
                      className="flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50"
                      style={goldBtn}
                    >
                      التالي
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>
                    {hasPermission(role, "delete") && editing ? (
                      <button
                        type="button"
                        onClick={() => void onDelete(editing)}
                        className="flex flex-1 items-center justify-center gap-1.5"
                        style={dangerOutlineBtn}
                      >
                        <Trash2 size={15} strokeWidth={1.55} />
                        حذف المنتج
                      </button>
                    ) : null}
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
                      type="button"
                      onClick={() => goTab("stock")}
                      className="flex flex-1 items-center justify-center gap-1.5"
                      style={goldBtn}
                    >
                      التالي
                      <ChevronLeft size={16} strokeWidth={2} />
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

              {tab === "stock" ? (
                <>
                  <div className="admin-pe-stock-wrap">
                    <div className="admin-pe-card admin-pe-price-card">
                      <h2 className="admin-pe-card-title">
                        <Wallet size={16} strokeWidth={1.7} />
                        السعر
                      </h2>
                      <div className="admin-pe-fields is-2 admin-pe-price-fields">
                        <div>
                          <label className="admin-pe-label" htmlFor="p-selling">
                            السعر (₪)
                          </label>
                          <input
                            id="p-selling"
                            type="number"
                            className="admin-pe-input"
                            value={form.sellingPrice}
                            onChange={(e) =>
                              setField("sellingPrice", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="admin-pe-label" htmlFor="p-purchase">
                            سعر الشراء
                          </label>
                          <input
                            id="p-purchase"
                            type="number"
                            className="admin-pe-input"
                            value={form.purchasePrice}
                            onChange={(e) =>
                              setField("purchasePrice", e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="admin-pe-label" htmlFor="p-currency">
                            العملة
                          </label>
                          <div className="admin-pe-input" id="p-currency">
                            ILS — شيكل
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="admin-pe-card">
                      <h2 className="admin-pe-card-title">
                        <Package size={16} strokeWidth={1.7} />
                        المخزون
                      </h2>
                      <div className="admin-pe-fields">
                        <div>
                          <label className="admin-pe-label" htmlFor="p-stock">
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
                            الحد الأدنى
                          </label>
                          <input
                            id="p-min"
                            type="number"
                            className="admin-pe-input"
                            value={form.minimumStock}
                            onChange={(e) =>
                              setField("minimumStock", e.target.value)
                            }
                          />
                          <p className="admin-pe-hint">
                            يُستخدم لتنبيهات انخفاض المخزون
                          </p>
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
                          <p className="admin-pe-hint">
                            {form.status === "active"
                              ? "المنتج متاح للمبيعات"
                              : "المنتج غير ظاهر للمبيعات حالياً"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="admin-pe-card is-summary">
                      <h2 className="admin-pe-card-title">
                        <CircleDot size={16} strokeWidth={1.7} />
                        ملخص المنتج
                      </h2>
                      <div className="admin-pe-summary-row">
                        <span>السعر</span>
                        <strong>
                          ₪{Number(form.sellingPrice || 0).toLocaleString("en-US")}
                        </strong>
                      </div>
                      <div className="admin-pe-summary-row">
                        <span>المخزون</span>
                        <strong>{stockQty}</strong>
                      </div>
                      <div className="admin-pe-summary-row">
                        <span>الحالة</span>
                        <span
                          className={
                            form.status === "active"
                              ? "admin-pe-pill is-active"
                              : "admin-pe-pill"
                          }
                        >
                          {statusLabel(form.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50"
                      style={goldBtn}
                    >
                      <Save size={16} strokeWidth={1.7} />
                      {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                    </button>
                    <button
                      type="button"
                      onClick={() => goTab("images")}
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
          </>
        )}
      </div>
    );

    return <div style={pageWrap}>{editorShell}</div>;
  }

  /* ───────────── Products list ───────────── */
  return (
    <div style={{ ...pageWrap, overflowX: "hidden" }}>
      {/* Header — ONE cube icon */}
      <header className="mb-4 md:mb-5">
        <div className="flex flex-col items-center text-center md:items-start md:text-start">
          <div className="flex items-center gap-2.5">
            <h1
              className="m-0 text-[1.45rem] font-semibold tracking-[-0.02em] md:text-[1.65rem]"
              style={{ color: "#FFFFFF", lineHeight: 1.35 }}
            >
              المنتجات
            </h1>
            <Box size={26} strokeWidth={1.45} color={GOLD} aria-hidden />
          </div>
          <p
            className="mb-0 mt-1.5 max-w-[28rem] text-[0.84rem] leading-relaxed md:text-[0.88rem]"
            style={{ color: MUTED }}
          >
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
              <option value="all">كل الفئات</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
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
            <option value="all">كل الفئات</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
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
    </div>
  );
}
