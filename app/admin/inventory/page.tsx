"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import ProductImagesField from "@/components/admin/ProductImagesField";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { formatPrice, slugify } from "@/lib/format";
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

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
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
  }, [products, query, category, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm(fromProduct(p));
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
        setMessage("Product updated");
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
        setMessage("Product added");
      }
      setModalOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
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
      setMessage("Product duplicated");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Duplicate failed");
    }
  }

  async function onDelete(p: Product) {
    if (!hasPermission(role, "delete")) {
      setMessage("You do not have permission to delete");
      return;
    }
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await apiFetch(`/api/products?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      setMessage("Product deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function field<K extends keyof ProductForm>(key: K, label: string, type = "text") {
    return (
      <div>
        <label className="label" htmlFor={`p-${key}`}>
          {label}
        </label>
        <input
          id={`p-${key}`}
          type={type}
          className="input"
          value={form[key] as string}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1
            className="mt-1 text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Products
          </h1>
          <p className="mt-1 text-sm text-[var(--slate)]">
            Manage frames, stock, pricing, and product photos.
          </p>
        </div>
        <button type="button" className="btn btn-accent" onClick={openCreate}>
          <Plus size={16} /> Add product
        </button>
      </header>

      <div className="admin-card flex flex-wrap gap-3 p-4">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto sm:min-w-[220px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
          />
          <input
            className="input pl-10"
            placeholder="Search name, brand, SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="select max-w-[200px]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="select max-w-[180px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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

      <div className="admin-card overflow-hidden">
        <div className="md:overflow-x-auto">
          <table className="table table-mobile-cards">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-[var(--slate)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-[var(--slate)]">
                    No products found
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const low = p.stockQuantity <= p.minimumStock;
                  const thumb = p.images?.[0];
                  return (
                    <tr
                      key={p.id}
                      className={low ? "bg-[rgba(212,175,55,0.08)]" : undefined}
                    >
                      <td data-label="Image">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--admin-elevated)]">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-[0.65rem] text-[var(--slate)]">
                              —
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Product">
                        <div className="font-medium text-[var(--ink)]">{p.name}</div>
                        <div className="text-xs text-[var(--slate)]">{p.sku}</div>
                      </td>
                      <td data-label="Category">{p.category}</td>
                      <td data-label="Brand">{p.brand || "—"}</td>
                      <td data-label="Price" className="font-semibold text-[var(--accent)]">
                        {formatPrice(p.sellingPrice)}
                      </td>
                      <td data-label="Stock">
                        <span
                          className={
                            low
                              ? "font-bold text-[var(--warning)]"
                              : "text-[var(--ink)]"
                          }
                        >
                          {p.stockQuantity}
                        </span>
                        <span className="text-xs text-[var(--slate)]">
                          {" "}
                          / min {p.minimumStock}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`status status-${p.status === "active" ? "confirmed" : p.status === "out_of_stock" ? "cancelled" : "pending"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td data-label="Actions" className="actions-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                            onClick={() => openEdit(p)}
                            aria-label="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                            onClick={() => void onDuplicate(p)}
                            aria-label="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                          {hasPermission(role, "delete") ? (
                            <button
                              type="button"
                              className="btn btn-ghost !min-h-11 !px-3 !text-xs text-[var(--danger)]"
                              onClick={() => void onDelete(p)}
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminModal
        open={modalOpen}
        title={editing ? "Edit product" : "Add product"}
        onClose={() => setModalOpen(false)}
        wide
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          {field("name", "Name")}
          <div>
            <label className="label" htmlFor="p-category">
              Category
            </label>
            <select
              id="p-category"
              className="select"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as ProductCategory,
                }))
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {field("brand", "Brand")}
          {field("frameType", "Frame type")}
          {field("lensType", "Lens type")}
          {field("barcode", "Barcode")}
          {field("sku", "SKU")}
          {field("supplier", "Supplier")}
          {field("purchasePrice", "Purchase price", "number")}
          {field("sellingPrice", "Selling price", "number")}
          {field("stockQuantity", "Stock quantity", "number")}
          {field("minimumStock", "Minimum stock", "number")}
          <div>
            <label className="label" htmlFor="p-status">
              Status
            </label>
            <select
              id="p-status"
              className="select"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as ProductStatus,
                }))
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <ProductImagesField
            images={form.images}
            onChange={(images) => setForm((f) => ({ ...f, images }))}
          />

          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-description">
              Description
            </label>
            <textarea
              id="p-description"
              className="textarea"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
