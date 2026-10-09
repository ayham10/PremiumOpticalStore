"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImageIcon, Package, Plus } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import ProductImagesField from "@/components/admin/ProductImagesField";
import { apiFetch } from "@/lib/admin-api";
import { slugify } from "@/lib/format";
import type { Product, ProductCategory, ProductStatus } from "@/lib/types";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

const CATEGORIES: ProductCategory[] = [
  "Prescription Glasses",
  "Sunglasses",
  "Contact Lenses",
  "Frames",
  "Accessories",
  "Cleaning Products",
];

type FormState = {
  name: string;
  category: ProductCategory;
  lensType: string;
  description: string;
  sellingPrice: string;
  stockQuantity: string;
  minimumStock: string;
  status: ProductStatus;
  images: string[];
};

function usesLensType(category: ProductCategory): boolean {
  return (
    category === "Contact Lenses" ||
    category === "Prescription Glasses" ||
    category === "Sunglasses"
  );
}

function emptyForm(): FormState {
  return {
    name: "",
    category: "Frames",
    lensType: "",
    description: "",
    sellingPrice: "0",
    stockQuantity: "0",
    minimumStock: "5",
    status: "active",
    images: [],
  };
}

function unwrapProduct(data: unknown): Product | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.product && typeof obj.product === "object") return obj.product as Product;
  if (typeof obj.id === "string" && typeof obj.name === "string") return data as Product;
  return null;
}

export default function AdminProductCreateModal({
  open,
  t,
  onClose,
  onCreated,
}: {
  open: boolean;
  t: Translate;
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<"details" | "images">("details");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setTab("details");
    setSaving(false);
    setError("");
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!form.name.trim()) {
      setTab("details");
      setError(t("admin.servicePages.productNameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await apiFetch<unknown>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          slug: slugify(form.name),
          category: form.category,
          lensType: usesLensType(form.category) ? form.lensType || undefined : undefined,
          description: form.description.trim(),
          images: form.images.filter(Boolean),
          sellingPrice: Number(form.sellingPrice) || 0,
          stockQuantity: Math.max(0, Math.floor(Number(form.stockQuantity) || 0)),
          minimumStock: Math.max(0, Math.floor(Number(form.minimumStock) || 0)),
          status: form.status,
        }),
      });
      const product = unwrapProduct(created);
      if (!product) throw new Error(t("admin.servicePages.productSaveError"));
      onCreated(product);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.servicePages.productSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title={t("admin.servicePages.addNewProduct")}
      onClose={onClose}
      wide
      icon={<Plus size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div className="admin-pe-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "details"}
          className={`admin-pe-tab${tab === "details" ? " is-active" : ""}`}
          onClick={() => setTab("details")}
        >
          <Package size={18} strokeWidth={1.7} />
          <span>{t("admin.servicePages.productDetails")}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "images"}
          className={`admin-pe-tab${tab === "images" ? " is-active" : ""}`}
          onClick={() => setTab("images")}
        >
          <ImageIcon size={18} strokeWidth={1.7} />
          <span>{t("admin.servicePages.productImages")}</span>
        </button>
      </div>
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-3">
        {tab === "details" ? (
          <>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productName")}</span>
              <input
                className="input"
                value={form.name}
                maxLength={100}
                onChange={(event) => setField("name", event.target.value)}
                required
              />
            </label>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productCategory")}</span>
              <select
                className="input"
                value={form.category}
                onChange={(event) =>
                  setField("category", event.target.value as ProductCategory)
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            {usesLensType(form.category) ? (
              <label className="admin-service-field">
                <span className="label">{t("admin.servicePages.productLensType")}</span>
                <input
                  className="input"
                  value={form.lensType}
                  onChange={(event) => setField("lensType", event.target.value)}
                />
              </label>
            ) : null}
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productDescription")}</span>
              <textarea
                className="textarea"
                rows={3}
                maxLength={300}
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />
            </label>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productPrice")}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.sellingPrice}
                onChange={(event) => setField("sellingPrice", event.target.value)}
              />
            </label>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productStock")}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.stockQuantity}
                onChange={(event) => setField("stockQuantity", event.target.value)}
              />
            </label>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productMinStock")}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="1"
                value={form.minimumStock}
                onChange={(event) => setField("minimumStock", event.target.value)}
              />
            </label>
            <label className="admin-service-field">
              <span className="label">{t("admin.servicePages.productStatus")}</span>
              <select
                className="input"
                value={form.status}
                onChange={(event) =>
                  setField("status", event.target.value as ProductStatus)
                }
              >
                <option value="active">{t("admin.servicePages.productActive")}</option>
                <option value="draft">{t("admin.servicePages.productDraft")}</option>
                <option value="out_of_stock">
                  {t("admin.servicePages.productOutOfStock")}
                </option>
              </select>
            </label>
          </>
        ) : (
          <ProductImagesField
            images={form.images}
            onChange={(images) => setField("images", images)}
            allowLibrary
            t={t}
          />
        )}
        <div className="admin-service-actions" style={{ marginTop: 8 }}>
          {tab === "details" ? (
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setTab("images")}
            >
              {t("admin.servicePages.productImages")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setTab("details")}
            >
              {t("admin.servicePages.productDetails")}
            </button>
          )}
          <button type="submit" className="btn btn-accent" disabled={saving}>
            {saving
              ? t("admin.servicePages.productSaving")
              : t("admin.servicePages.productSave")}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
