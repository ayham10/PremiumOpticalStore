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
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Package,
  Plus,
  Search,
  Trash2,
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

const PAGE_BG = "#0E1116";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const GOLD = "#D4AF6A";
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

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 45,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD_BG,
  color: "#FFFFFF",
  padding: "0 0.75rem",
  font: "inherit",
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: "0.78rem",
  fontWeight: 500,
  color: MUTED,
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} style={labelStyle}>
      {children}
    </label>
  );
}

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

    return (
      <div style={pageWrap}>
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={closeEditor}
              aria-label="رجوع"
              className="grid shrink-0 place-items-center rounded-[12px]"
              style={{
                width: 42,
                height: 42,
                border: `1px solid ${BORDER}`,
                background: CARD_BG,
                color: "#FFFFFF",
              }}
            >
              <ChevronRight size={18} strokeWidth={1.6} />
            </button>
            <div className="min-w-0">
              <h1
                className="m-0 truncate text-[1.2rem] font-semibold"
                style={{ color: "#FFFFFF", lineHeight: 1.4 }}
              >
                {editing ? "تعديل المنتج" : "إضافة منتج"}
              </h1>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSubmit()}
            className="shrink-0 rounded-[12px] px-4 text-[0.9rem] font-bold disabled:opacity-50"
            style={{
              height: 46,
              background: GOLD,
              color: "#0B0F14",
              border: "none",
            }}
          >
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
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
                background: CARD_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 16,
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
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-[12px] text-[0.9rem] font-semibold"
                style={{
                  height: 48,
                  background: "rgba(224,122,122,0.1)",
                  border: "1px solid rgba(224,122,122,0.4)",
                  color: "#F07178",
                }}
              >
                <Trash2 size={16} strokeWidth={1.55} />
                حذف المنتج
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div
              className="mb-4 flex gap-1 overflow-x-auto"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="shrink-0 px-3 pb-2.5 pt-1 text-[0.84rem] font-semibold"
                    style={{
                      color: active ? GOLD : MUTED,
                      background: "transparent",
                      border: "none",
                      borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="space-y-3"
            >
              {tab === "details" ? (
                <div
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 13,
                  }}
                >
                  <div>
                    <FieldLabel htmlFor="p-name">اسم المنتج</FieldLabel>
                    <input
                      id="p-name"
                      style={fieldStyle}
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-category">الفئة</FieldLabel>
                    <select
                      id="p-category"
                      style={fieldStyle}
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
                    <FieldLabel htmlFor="p-brand">العلامة التجارية</FieldLabel>
                    <input
                      id="p-brand"
                      style={fieldStyle}
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-frame">نوع الإطار</FieldLabel>
                    <input
                      id="p-frame"
                      style={fieldStyle}
                      value={form.frameType}
                      onChange={(e) => setField("frameType", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-lens">نوع العدسة</FieldLabel>
                    <input
                      id="p-lens"
                      style={fieldStyle}
                      value={form.lensType}
                      onChange={(e) => setField("lensType", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-sku">SKU</FieldLabel>
                    <input
                      id="p-sku"
                      style={fieldStyle}
                      value={form.sku}
                      onChange={(e) => setField("sku", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-barcode">الباركود</FieldLabel>
                    <input
                      id="p-barcode"
                      style={fieldStyle}
                      value={form.barcode}
                      onChange={(e) => setField("barcode", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-supplier">المورد</FieldLabel>
                    <input
                      id="p-supplier"
                      style={fieldStyle}
                      value={form.supplier}
                      onChange={(e) => setField("supplier", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-description">وصف المنتج</FieldLabel>
                    <textarea
                      id="p-description"
                      style={{
                        ...fieldStyle,
                        height: "auto",
                        minHeight: 90,
                        padding: "0.7rem 0.75rem",
                        resize: "vertical",
                      }}
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : null}

              {tab === "images" ? (
                <div
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <p
                    className="mb-3 mt-0 text-[0.9rem] font-semibold"
                    style={{ color: "#FFFFFF" }}
                  >
                    صور المنتج
                  </p>
                  <ProductImagesField
                    images={form.images}
                    onChange={(images) => setField("images", images)}
                  />
                </div>
              ) : null}

              {tab === "stock" ? (
                <div
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 16,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 13,
                  }}
                >
                  <div>
                    <FieldLabel htmlFor="p-purchase">سعر الشراء</FieldLabel>
                    <input
                      id="p-purchase"
                      type="number"
                      style={fieldStyle}
                      value={form.purchasePrice}
                      onChange={(e) => setField("purchasePrice", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-selling">سعر البيع</FieldLabel>
                    <input
                      id="p-selling"
                      type="number"
                      style={fieldStyle}
                      value={form.sellingPrice}
                      onChange={(e) => setField("sellingPrice", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-stock">المخزون</FieldLabel>
                    <input
                      id="p-stock"
                      type="number"
                      style={fieldStyle}
                      value={form.stockQuantity}
                      onChange={(e) => setField("stockQuantity", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-min">الحد الأدنى للمخزون</FieldLabel>
                    <input
                      id="p-min"
                      type="number"
                      style={fieldStyle}
                      value={form.minimumStock}
                      onChange={(e) => setField("minimumStock", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="p-status">الحالة</FieldLabel>
                    <select
                      id="p-status"
                      style={fieldStyle}
                      value={form.status}
                      onChange={(e) =>
                        setField("status", e.target.value as ProductStatus)
                      }
                    >
                      <option value="active">نشط</option>
                      <option value="draft">غير نشط</option>
                      <option value="archived">مؤرشف</option>
                      <option value="out_of_stock">غير متوفر</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-[12px] text-[0.9rem] font-bold disabled:opacity-50"
                  style={{
                    height: 48,
                    background: GOLD,
                    color: "#0B0F14",
                    border: "none",
                  }}
                >
                  {saving ? "جارٍ الحفظ…" : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-[12px] px-4 text-[0.86rem] font-semibold"
                  style={{
                    height: 48,
                    background: CARD_BG,
                    border: `1px solid ${BORDER}`,
                    color: "#FFFFFF",
                  }}
                >
                  إلغاء
                </button>
              </div>

              {hasPermission(role, "delete") && editing ? (
                <button
                  type="button"
                  onClick={() => void onDelete(editing)}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] text-[0.9rem] font-semibold"
                  style={{
                    height: 48,
                    background: "rgba(224,122,122,0.1)",
                    border: "1px solid rgba(224,122,122,0.4)",
                    color: "#F07178",
                  }}
                >
                  <Trash2 size={16} strokeWidth={1.55} />
                  حذف المنتج
                </button>
              ) : null}
            </form>
          </>
        )}
      </div>
    );
  }

  /* ───────────── Products list ───────────── */
  const compactSelect: CSSProperties = {
    height: 40,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: CARD_BG,
    color: "#FFFFFF",
    padding: "0 0.6rem",
    font: "inherit",
    fontSize: "0.78rem",
    fontWeight: 600,
    outline: "none",
    maxWidth: "100%",
  };

  return (
    <div style={{ ...pageWrap, overflowX: "hidden" }}>
      <header className="mb-[18px] flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Package
              className="hidden shrink-0 md:block"
              size={32}
              strokeWidth={1.45}
              color={GOLD}
            />
            <Package
              className="shrink-0 md:hidden"
              size={26}
              strokeWidth={1.45}
              color={GOLD}
            />
            <h1
              className="m-0 text-[1.4rem] font-semibold tracking-[-0.02em] md:text-[1.5rem]"
              style={{ color: "#FFFFFF", lineHeight: 1.4 }}
            >
              المنتجات
            </h1>
          </div>
          <p
            className="mb-0 mt-1 text-[0.86rem] leading-relaxed"
            style={{ color: MUTED }}
          >
            إدارة المنتجات والمخزون والأسعار والصور
          </p>
          <p className="mb-0 mt-1.5 text-[0.82rem] font-semibold" style={{ color: MUTED }}>
            <span style={{ color: GOLD }}>{filtered.length}</span> منتج
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[12px] px-3.5 text-[0.84rem] font-bold"
          style={{
            height: 40,
            background: "rgba(212,175,106,0.12)",
            color: GOLD,
            border: "1px solid rgba(212,175,106,0.55)",
          }}
        >
          إضافة منتج
          <Plus size={15} strokeWidth={1.7} />
        </button>
      </header>

      <section className="mb-[18px] flex flex-nowrap items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
        <div className="relative shrink-0" style={{ width: "10.75rem" }}>
          <Search
            size={14}
            strokeWidth={1.55}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 10, color: MUTED }}
          />
          <input
            style={{
              ...compactSelect,
              width: "100%",
              paddingInlineStart: 30,
              fontWeight: 500,
            }}
            placeholder="ابحث بالاسم…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          style={{ ...compactSelect, width: "auto", minWidth: "7rem" }}
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

        <select
          className="hidden md:block"
          style={{ ...compactSelect, width: "auto", minWidth: "7rem" }}
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

        <select
          className="hidden md:block"
          style={{ ...compactSelect, width: "auto", minWidth: "7.25rem" }}
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
        >
          <option value="newest">الأحدث أولاً</option>
          <option value="name">حسب الاسم</option>
        </select>
      </section>

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
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
            <div
              className="mt-5 flex items-center justify-center gap-2"
              style={{ paddingBottom: 4 }}
            >
              <button
                type="button"
                aria-label="السابق"
                disabled={safePage <= 1}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                className="grid place-items-center rounded-[11px] disabled:opacity-35"
                style={{
                  width: 38,
                  height: 38,
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  color: GOLD,
                }}
              >
                <ChevronRight size={16} strokeWidth={1.6} />
              </button>
              <div
                className="inline-flex items-center gap-1.5 rounded-[11px] px-3 text-[0.8rem] font-semibold"
                style={{
                  height: 38,
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                <span style={{ color: GOLD }}>{safePage}</span>
                <span>/</span>
                <span>{totalPages}</span>
              </div>
              <button
                type="button"
                aria-label="التالي"
                disabled={safePage >= totalPages}
                onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                className="grid place-items-center rounded-[11px] disabled:opacity-35"
                style={{
                  width: 38,
                  height: 38,
                  background: CARD_BG,
                  border: `1px solid ${BORDER}`,
                  color: GOLD,
                }}
              >
                <ChevronLeft size={16} strokeWidth={1.6} />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
