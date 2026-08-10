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
  ImageIcon,
  Minus,
  Package,
  Plus,
  Save,
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

const fieldStyle: CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 11,
  border: `1px solid ${BORDER}`,
  background: "#12161D",
  color: "#FFFFFF",
  padding: "0 0.75rem",
  font: "inherit",
  outline: "none",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontSize: "0.78rem",
  fontWeight: 500,
  color: MUTED,
};

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
      <div className="mx-auto w-full" style={{ maxWidth: 430 }}>
        <header className="mb-4 flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (editing && tab !== "overview") setTab("overview");
              else closeEditor();
            }}
            aria-label="رجوع"
            className="mt-0.5 grid shrink-0 place-items-center rounded-[12px]"
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
          <div className="min-w-0 flex-1 text-center">
            <h1
              className="m-0 text-[1.15rem] font-semibold"
              style={{ color: "#FFFFFF", lineHeight: 1.35 }}
            >
              {editing ? "تعديل المنتج" : "إضافة منتج"}
            </h1>
            <p className="mb-0 mt-1 text-[0.78rem]" style={{ color: MUTED }}>
              قم بتحديث بيانات المنتج
            </p>
          </div>
          <span
            className="mt-0.5 grid shrink-0 place-items-center rounded-[12px]"
            style={{
              width: 42,
              height: 42,
              border: `1px solid rgba(212,175,55,0.35)`,
              background: "rgba(212,175,55,0.08)",
              color: GOLD,
            }}
            aria-hidden
          >
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
            <div
              className="mb-4 flex justify-center gap-1 overflow-x-auto"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="shrink-0 px-3.5 pb-2.5 pt-1 text-[0.82rem] font-semibold"
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
              className="flex flex-col gap-4"
            >
              {tab === "details" ? (
                <>
                  <div style={{ ...editorCard, display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <FieldLabel htmlFor="p-name">اسم المنتج</FieldLabel>
                      <div className="relative">
                        <input
                          id="p-name"
                          style={{ ...fieldStyle, paddingInlineEnd: "3.4rem" }}
                          value={form.name}
                          maxLength={100}
                          onChange={(e) => setField("name", e.target.value)}
                          required
                        />
                        <span
                          className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-[0.7rem] tabular-nums"
                          style={{ color: MUTED }}
                        >
                          {form.name.length}/100
                        </span>
                      </div>
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
                    <div className="grid grid-cols-2 gap-3">
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
                        <div className="relative">
                          <input
                            id="p-barcode"
                            style={{ ...fieldStyle, paddingInlineEnd: "2.4rem" }}
                            value={form.barcode}
                            onChange={(e) => setField("barcode", e.target.value)}
                          />
                          <span
                            className="pointer-events-none absolute inset-y-0 end-2.5 grid place-items-center"
                            style={{ color: GOLD }}
                          >
                            <Barcode size={15} strokeWidth={1.5} />
                          </span>
                        </div>
                      </div>
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
                      <div className="relative">
                        <textarea
                          id="p-description"
                          style={{
                            ...fieldStyle,
                            height: "auto",
                            minHeight: 96,
                            padding: "0.7rem 0.75rem",
                            paddingBottom: "1.6rem",
                            resize: "vertical",
                          }}
                          value={form.description}
                          maxLength={300}
                          onChange={(e) => setField("description", e.target.value)}
                          required
                        />
                        <span
                          className="pointer-events-none absolute bottom-2 end-3 text-[0.7rem] tabular-nums"
                          style={{ color: MUTED }}
                        >
                          {form.description.length}/300
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex items-center justify-between gap-2 pt-1"
                      style={{ borderTop: `1px solid ${BORDER}`, marginTop: 2, paddingTop: 12 }}
                    >
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold"
                        style={{
                          background:
                            form.status === "active"
                              ? "rgba(94,196,154,0.16)"
                              : "rgba(138,146,156,0.14)",
                          color: form.status === "active" ? "#5EC49A" : MUTED,
                        }}
                      >
                        {statusLabel(form.status)}
                      </span>
                      {updatedLabel ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-[0.72rem]"
                          style={{ color: MUTED }}
                        >
                          <Calendar size={13} strokeWidth={1.5} color={GOLD} />
                          آخر تحديث: {updatedLabel}
                        </span>
                      ) : null}
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
                  <div style={editorCard}>
                    <h2
                      className="m-0 text-[0.95rem] font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      صور المنتج
                    </h2>
                    <p className="mb-3.5 mt-1 text-[0.76rem]" style={{ color: MUTED }}>
                      يمكنك إضافة حتى 6 صور
                    </p>
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
                  <div style={{ ...editorCard, display: "flex", flexDirection: "column", gap: 14 }}>
                    <h2 className="m-0 text-[0.95rem] font-semibold" style={{ color: "#FFFFFF" }}>
                      السعر
                    </h2>
                    <div>
                      <FieldLabel htmlFor="p-selling">السعر (₪)</FieldLabel>
                      <div className="relative">
                        <input
                          id="p-selling"
                          type="number"
                          style={{ ...fieldStyle, paddingInlineStart: "2.2rem" }}
                          value={form.sellingPrice}
                          onChange={(e) => setField("sellingPrice", e.target.value)}
                        />
                        <span
                          className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-[0.9rem] font-bold"
                          style={{ color: GOLD }}
                        >
                          ₪
                        </span>
                      </div>
                    </div>
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
                      <FieldLabel htmlFor="p-currency">العملة</FieldLabel>
                      <div
                        style={{
                          ...fieldStyle,
                          display: "flex",
                          alignItems: "center",
                          color: "#FFFFFF",
                        }}
                      >
                        ILS — شيكل
                      </div>
                    </div>
                  </div>

                  <div style={{ ...editorCard, display: "flex", flexDirection: "column", gap: 14 }}>
                    <h2 className="m-0 text-[0.95rem] font-semibold" style={{ color: "#FFFFFF" }}>
                      المخزون
                    </h2>
                    <div>
                      <FieldLabel htmlFor="p-stock">الكمية المتوفرة</FieldLabel>
                      <div
                        className="flex items-center justify-between gap-3"
                        style={{
                          height: 46,
                          borderRadius: 11,
                          border: `1px solid ${BORDER}`,
                          background: "#12161D",
                          padding: "0 0.45rem",
                        }}
                      >
                        <button
                          type="button"
                          aria-label="إنقاص"
                          className="grid place-items-center rounded-[9px]"
                          style={{
                            width: 36,
                            height: 36,
                            border: `1px solid ${BORDER}`,
                            background: CARD_BG,
                            color: GOLD,
                          }}
                          onClick={() =>
                            setField("stockQuantity", String(Math.max(0, stockQty - 1)))
                          }
                        >
                          <Minus size={15} strokeWidth={2} />
                        </button>
                        <input
                          id="p-stock"
                          type="number"
                          className="min-w-0 flex-1 border-0 bg-transparent text-center text-[1rem] font-semibold tabular-nums outline-none"
                          style={{ color: "#FFFFFF", font: "inherit" }}
                          value={form.stockQuantity}
                          onChange={(e) => setField("stockQuantity", e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label="زيادة"
                          className="grid place-items-center rounded-[9px]"
                          style={{
                            width: 36,
                            height: 36,
                            border: `1px solid ${BORDER}`,
                            background: CARD_BG,
                            color: GOLD,
                          }}
                          onClick={() => setField("stockQuantity", String(stockQty + 1))}
                        >
                          <Plus size={15} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <FieldLabel htmlFor="p-min">الحد الأدنى</FieldLabel>
                      <input
                        id="p-min"
                        type="number"
                        style={fieldStyle}
                        value={form.minimumStock}
                        onChange={(e) => setField("minimumStock", e.target.value)}
                      />
                      <p className="mb-0 mt-1.5 text-[0.7rem]" style={{ color: MUTED }}>
                        يُستخدم لتنبيهات انخفاض المخزون
                      </p>
                    </div>
                    <div>
                      <FieldLabel htmlFor="p-status">حالة المنتج</FieldLabel>
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
                      <p className="mb-0 mt-1.5 text-[0.7rem]" style={{ color: MUTED }}>
                        {form.status === "active"
                          ? "المنتج متاح للمبيعات"
                          : "المنتج غير ظاهر للمبيعات حالياً"}
                      </p>
                    </div>
                  </div>

                  <div style={{ ...editorCard, padding: "14px 16px" }}>
                    <h2
                      className="mb-3 mt-0 text-[0.9rem] font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      ملخص المنتج
                    </h2>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-[0.8rem]">
                        <span style={{ color: MUTED }}>السعر</span>
                        <span className="font-semibold tabular-nums" style={{ color: "#FFFFFF" }}>
                          ₪{Number(form.sellingPrice || 0).toLocaleString("en-US")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[0.8rem]">
                        <span style={{ color: MUTED }}>المخزون</span>
                        <span className="font-semibold tabular-nums" style={{ color: "#FFFFFF" }}>
                          {stockQty}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[0.8rem]">
                        <span style={{ color: MUTED }}>الحالة</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.72rem] font-bold"
                          style={{
                            background:
                              form.status === "active"
                                ? "rgba(94,196,154,0.16)"
                                : "rgba(138,146,156,0.14)",
                            color: form.status === "active" ? "#5EC49A" : MUTED,
                          }}
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
  const compactSelect: CSSProperties = {
    height: 40,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: CARD_BG,
    color: "#FFFFFF",
    padding: "0 0.65rem",
    font: "inherit",
    fontSize: "0.78rem",
    fontWeight: 600,
    outline: "none",
    maxWidth: "100%",
  };

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

      {/* MOBILE toolbar: Add, Search | Category, count */}
      <section className="mb-3.5 space-y-2.5 md:hidden">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] text-[0.88rem] font-bold"
          style={{
            height: 42,
            background: "transparent",
            color: GOLD,
            border: `1px solid rgba(212,175,55,0.75)`,
          }}
        >
          <Plus size={15} strokeWidth={1.7} />
          إضافة منتج
        </button>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-[1.35]">
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
                height: 40,
                paddingInlineStart: 30,
                fontWeight: 500,
                border: `1px solid rgba(212,175,55,0.55)`,
              }}
              placeholder="ابحث…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            style={{
              ...compactSelect,
              height: 40,
              width: "auto",
              minWidth: "6.75rem",
              flex: "0.85",
              border: `1px solid rgba(212,175,55,0.55)`,
            }}
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
        </div>
        <p
          className="mb-0 text-start text-[0.8rem] font-semibold tabular-nums"
          style={{ color: MUTED }}
        >
          {filtered.length} منتج
        </p>
      </section>

      {/* DESKTOP toolbar — compact row */}
      <section className="mb-5 hidden flex-wrap items-center gap-2.5 md:flex">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-3 text-[0.8rem] font-bold"
          style={{
            height: 38,
            background: "transparent",
            color: GOLD,
            border: `1px solid rgba(212,175,55,0.7)`,
          }}
        >
          إضافة منتج
          <Plus size={14} strokeWidth={1.7} />
        </button>

        <span
          className="shrink-0 text-[0.8rem] font-semibold tabular-nums"
          style={{ color: MUTED }}
        >
          <span style={{ color: GOLD }}>{filtered.length}</span> منتج
        </span>

        <select
          style={{ ...compactSelect, height: 38, width: "auto", minWidth: "7.5rem" }}
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
        >
          <option value="newest">الأحدث أولاً</option>
          <option value="name">حسب الاسم</option>
        </select>

        <select
          style={{ ...compactSelect, height: 38, width: "auto", minWidth: "7rem" }}
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
          style={{ ...compactSelect, height: 38, width: "auto", minWidth: "7rem" }}
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

        <div className="relative ms-auto min-w-[12rem] max-w-[16rem] flex-1">
          <Search
            size={14}
            strokeWidth={1.55}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 10, color: MUTED }}
          />
          <input
            style={{
              ...compactSelect,
              height: 38,
              width: "100%",
              paddingInlineStart: 30,
              fontWeight: 500,
            }}
            placeholder="ابحث بالاسم…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
          <div className="grid grid-cols-1 gap-[15px] md:grid-cols-4 md:gap-[18px] md:items-stretch">
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
