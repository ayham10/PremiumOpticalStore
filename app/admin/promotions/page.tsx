"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  FileText,
  Glasses,
  Package,
  Pencil,
  Percent,
  Plus,
  Save,
  Settings,
  Tag,
  Target,
  Trash2,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import SingleImageField from "@/components/admin/SingleImageField";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import { cn, formatPrice } from "@/lib/format";
import type {
  AdminSession,
  DiscountType,
  Product,
  Promotion,
  PromotionScope,
} from "@/lib/types";

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

type PromoForm = {
  title: string;
  description: string;
  couponCode: string;
  discountType: DiscountType;
  discountValue: string;
  scope: PromotionScope;
  productIds: string[];
  image: string;
  startDate: string;
  endDate: string;
  homepageVisible: boolean;
  priority: string;
  active: boolean;
};

const emptyForm = (): PromoForm => ({
  title: "",
  description: "",
  couponCode: "",
  discountType: "percentage",
  discountValue: "",
  scope: "all",
  productIds: [],
  image: "",
  startDate: "",
  endDate: "",
  homepageVisible: true,
  priority: "1",
  active: true,
});

function fromPromo(p: Promotion): PromoForm {
  let discountType: DiscountType = p.discountType || "percentage";
  let discountValue =
    p.discountValue !== undefined && p.discountValue !== null
      ? String(p.discountValue)
      : "";

  if (!discountValue && p.discount) {
    const pct = p.discount.match(/(\d+(?:\.\d+)?)\s*%/);
    const fixed = p.discount.match(/(\d+(?:\.\d+)?)/);
    if (pct) {
      discountType = "percentage";
      discountValue = pct[1];
    } else if (fixed) {
      discountType = p.discountType || "fixed";
      discountValue = fixed[1];
    }
  }

  return {
    title: p.title,
    description: p.description,
    couponCode: p.couponCode || "",
    discountType,
    discountValue,
    scope: p.scope || "all",
    productIds: p.productIds || [],
    image: p.image || "",
    startDate: p.startDate,
    endDate: p.endDate,
    homepageVisible: p.homepageVisible,
    priority: String(p.priority),
    active: p.active,
  };
}

function discountLabel(p: Promotion): string {
  if (p.discountValue !== undefined && p.discountValue !== null) {
    if (p.discountType === "fixed") return formatPrice(p.discountValue);
    return `${p.discountValue}%`;
  }
  return p.discount || "—";
}

const SCOPE_ICONS = {
  all: Package,
  sunglasses: Glasses,
  frames: Glasses,
  specific: Package,
} as const;

const OFFER_SECTIONS = {
  ar: {
    details: "تفاصيل العرض",
    period: "فترة العرض",
    more: "إعدادات إضافية",
  },
  en: {
    details: "Offer details",
    period: "Offer period",
    more: "Additional settings",
  },
  he: {
    details: "פרטי המבצע",
    period: "תקופת המבצע",
    more: "הגדרות נוספות",
  },
} as const;

export default function AdminPromotionsPage() {
  const { t, locale } = useLocale();
  const sections = OFFER_SECTIONS[locale] || OFFER_SECTIONS.ar;
  const [items, setItems] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, me, productData] = await Promise.all([
        apiFetch<unknown>("/api/promotions"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null
        ),
        apiFetch<unknown>("/api/products?all=1").catch(() => null),
      ]);
      setItems(unwrapList<Promotion>(data, ["promotions", "items", "data"]));
      if (productData) {
        setProducts(
          unwrapList<Product>(productData, ["products", "items", "data"])
        );
      }
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.promotions.loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.brand, p.sku, p.category]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q))
    );
  }, [products, productQuery]);

  const sorted = useMemo(
    () => items.slice().sort((a, b) => a.priority - b.priority),
    [items]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setProductQuery("");
    setModalOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditing(p);
    setForm(fromPromo(p));
    setProductQuery("");
    setModalOpen(true);
  }

  function toggleProduct(id: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((x) => x !== id)
        : [...f.productIds, id],
    }));
  }

  function scopeLabel(scope?: PromotionScope) {
    switch (scope) {
      case "sunglasses":
        return t("admin.promotions.scopeSunglasses");
      case "frames":
        return t("admin.promotions.scopeFrames");
      case "specific":
        return t("admin.promotions.scopeSpecific");
      default:
        return t("admin.promotions.scopeAll");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const value = Number(form.discountValue);
    const payload = {
      title: form.title,
      description: form.description,
      couponCode: form.couponCode || undefined,
      discountType: form.discountType,
      discountValue: Number.isFinite(value) ? value : 0,
      discount: "",
      scope: form.scope,
      productIds: form.scope === "specific" ? form.productIds : [],
      image: form.image || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      homepageVisible: form.homepageVisible,
      priority: Number(form.priority) || 0,
      active: form.active,
    };
    try {
      if (editing) {
        const updated = await apiFetch<Promotion | { promotion: Promotion }>(
          "/api/promotions",
          { method: "PUT", body: JSON.stringify({ id: editing.id, ...payload }) }
        );
        const row =
          updated && typeof updated === "object" && "promotion" in updated
            ? updated.promotion
            : (updated as Promotion);
        setItems((prev) =>
          prev.map((p) => (p.id === editing.id ? { ...p, ...row } : p))
        );
        setMessage(t("admin.promotions.updated"));
      } else {
        const created = await apiFetch<Promotion | { promotion: Promotion }>(
          "/api/promotions",
          { method: "POST", body: JSON.stringify(payload) }
        );
        const row =
          created && typeof created === "object" && "promotion" in created
            ? created.promotion
            : (created as Promotion);
        setItems((prev) => [row, ...prev]);
        setMessage(t("admin.promotions.created"));
      }
      setModalOpen(false);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.promotions.saveError")
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: Promotion) {
    if (!hasPermission(role, "delete")) {
      setMessage(t("admin.promotions.deleteDenied"));
      return;
    }
    if (!confirm(t("admin.promotions.deleteConfirm", { title: p.title }))) {
      return;
    }
    try {
      await apiFetch(`/api/promotions?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      setMessage(t("admin.promotions.deleted"));
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : t("admin.promotions.deleteError")
      );
    }
  }

  return (
    <div className="admin-offers-page">
      <div className="admin-offers-inner">
        <header className="admin-offers-header">
          <p className="admin-offers-kicker">{t("admin.promotions.kicker")}</p>
          <h1 className="admin-offers-title">{t("admin.promotions.title")}</h1>
          <p className="admin-offers-lead">{t("admin.promotions.description")}</p>
        </header>

        <button
          type="button"
          onClick={openCreate}
          className="admin-offers-add"
        >
          <Plus size={15} strokeWidth={1.7} />
          {t("admin.promotions.add")}
        </button>

        {message ? (
          <p className="admin-offers-flash is-ok">{message}</p>
        ) : null}
        {error ? <p className="admin-offers-flash is-error">{error}</p> : null}

        {loading ? (
          <p className="admin-offers-loading">{t("admin.promotions.loading")}</p>
        ) : (
          <>
            {sorted.length > 0 ? (
              <ul className="admin-offers-grid">
                {sorted.map((p) => (
                  <li key={p.id}>
                    <article className="admin-offers-card">
                      <div className="admin-offers-card-top">
                        <div className="admin-offers-card-copy">
                          <h2 className="admin-offers-card-name">{p.title}</h2>
                          <p className="admin-offers-card-desc">{p.description}</p>
                        </div>
                        <span
                          className={
                            p.active
                              ? "admin-offers-status"
                              : "admin-offers-status is-off"
                          }
                        >
                          {p.active
                            ? t("admin.promotions.active")
                            : t("admin.promotions.off")}
                        </span>
                      </div>

                      <div className="admin-offers-meta">
                        <span className="admin-offers-discount">
                          <BadgePercent size={14} strokeWidth={1.8} />
                          {discountLabel(p)}
                        </span>
                        <p className="admin-offers-meta-row">
                          <Tag size={14} strokeWidth={1.7} />
                          <span>{scopeLabel(p.scope)}</span>
                        </p>
                        <p className="admin-offers-meta-row">
                          <CalendarDays size={14} strokeWidth={1.7} />
                          <span dir="ltr">
                            {p.startDate} → {p.endDate}
                          </span>
                        </p>
                      </div>

                      <div className="admin-offers-actions">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={t("admin.promotions.edit")}
                          className="admin-offers-icon-btn"
                        >
                          <Pencil size={13} strokeWidth={1.6} />
                        </button>
                        {hasPermission(role, "delete") ? (
                          <button
                            type="button"
                            onClick={() => void onDelete(p)}
                            aria-label="حذف"
                            className="admin-offers-icon-btn is-danger"
                          >
                            <Trash2 size={13} strokeWidth={1.6} />
                          </button>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}

            <button
              type="button"
              className="admin-offers-empty"
              onClick={openCreate}
            >
              <span className="admin-offers-empty-icon">
                <Plus size={16} strokeWidth={1.8} />
              </span>
              <span className="admin-offers-empty-title">
                {t("admin.promotions.add")}
              </span>
              {sorted.length === 0 ? (
                <span className="admin-offers-empty-lead">
                  {t("admin.promotions.empty")}
                </span>
              ) : null}
            </button>
          </>
        )}
      </div>

      <AdminModal
        open={modalOpen}
        title={
          editing ? t("admin.promotions.edit") : t("admin.promotions.create")
        }
        onClose={() => setModalOpen(false)}
        wide
        className="admin-offer-modal overflow-hidden !pb-0"
        icon={<Tag size={18} strokeWidth={1.7} />}
      >
        <form onSubmit={onSubmit} className="admin-offer-form">
          <div className="admin-offer-form-body">
            <section className="admin-offer-section">
              <h3 className="admin-offer-section-title">
                <FileText
                  size={14}
                  strokeWidth={1.7}
                  color="#D4AF37"
                  style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                />
                {sections.details}
              </h3>
              <div className="admin-offer-fields">
                <label className="admin-offer-field admin-offer-field-full">
                  <span>{t("admin.promotions.fieldTitle")}</span>
                  <input
                    id="pr-title"
                    className="admin-offer-input"
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="admin-offer-field admin-offer-field-full">
                  <span>{t("admin.promotions.fieldDescription")}</span>
                  <textarea
                    id="pr-desc"
                    className="admin-offer-input admin-offer-textarea"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    required
                  />
                </label>
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldCoupon")}</span>
                  <input
                    id="pr-coupon"
                    className="admin-offer-input"
                    value={form.couponCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, couponCode: e.target.value }))
                    }
                  />
                </label>
              </div>
            </section>

            <section className="admin-offer-section">
              <h3 className="admin-offer-section-title">
                <Percent
                  size={14}
                  strokeWidth={1.7}
                  color="#D4AF37"
                  style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                />
                {t("admin.promotions.colDiscount")}
              </h3>
              <div className="admin-offer-fields admin-offer-fields-2">
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldDiscountType")}</span>
                  <select
                    id="pr-dtype"
                    className="admin-offer-input"
                    value={form.discountType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        discountType: e.target.value as DiscountType,
                      }))
                    }
                  >
                    <option value="percentage">
                      {t("admin.promotions.typePercentage")}
                    </option>
                    <option value="fixed">
                      {t("admin.promotions.typeFixed")}
                    </option>
                  </select>
                </label>
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldDiscountValue")}</span>
                  <input
                    id="pr-dval"
                    type="number"
                    min={0}
                    step="any"
                    className="admin-offer-input"
                    value={form.discountValue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discountValue: e.target.value }))
                    }
                    required
                  />
                </label>
              </div>
            </section>

            <section className="admin-offer-section">
              <h3 className="admin-offer-section-title">
                <Target
                  size={14}
                  strokeWidth={1.7}
                  color="#D4AF37"
                  style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                />
                {t("admin.promotions.fieldScope")}
              </h3>
              <div className="admin-offer-chips">
                {SCOPES.map((scope) => {
                  const ScopeIcon = SCOPE_ICONS[scope];
                  return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, scope }))}
                    className={cn(
                      "admin-offer-chip",
                      form.scope === scope && "is-selected",
                    )}
                  >
                    <ScopeIcon
                      size={14}
                      strokeWidth={1.7}
                      color="#D4AF37"
                      style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                    />
                    {scopeLabel(scope)}
                  </button>
                  );
                })}
              </div>

              {form.scope === "specific" ? (
                <div className="admin-offer-products">
                  <div className="admin-offer-products-head">
                    <label htmlFor="pr-product-q">
                      {t("admin.promotions.searchProducts")}
                    </label>
                    <span>
                      {t("admin.promotions.selectedCount", {
                        n: form.productIds.length,
                      })}
                    </span>
                  </div>
                  <input
                    id="pr-product-q"
                    className="admin-offer-input"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder={t("admin.promotions.searchProducts")}
                  />
                  <div className="admin-offer-product-list">
                    {filteredProducts.length === 0 ? (
                      <p className="admin-offer-empty-note">
                        {t("admin.promotions.noProducts")}
                      </p>
                    ) : (
                      filteredProducts.map((product) => {
                        const selected = form.productIds.includes(product.id);
                        const thumb =
                          product.images[0] || "/images/placeholder-frame.svg";
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => toggleProduct(product.id)}
                            className={cn(
                              "admin-offer-product",
                              selected && "is-selected",
                            )}
                          >
                            <span className="admin-offer-product-thumb">
                              <Image
                                src={thumb}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            </span>
                            <span className="admin-offer-product-copy">
                              <span>{product.name}</span>
                              <span>
                                {product.brand} · {product.category} ·{" "}
                                {formatPrice(product.sellingPrice)}
                              </span>
                            </span>
                            {selected ? (
                              <Check size={16} className="admin-offer-check" />
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="admin-offer-section">
              <h3 className="admin-offer-section-title">
                <CalendarDays
                  size={14}
                  strokeWidth={1.7}
                  color="#D4AF37"
                  style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                />
                {sections.period}
              </h3>
              <div className="admin-offer-fields admin-offer-fields-2">
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldStart")}</span>
                  <span className="admin-offer-control">
                    <CalendarDays size={16} />
                    <input
                      id="pr-start"
                      type="date"
                      className="admin-offer-input has-icon"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                      required
                    />
                  </span>
                </label>
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldEnd")}</span>
                  <span className="admin-offer-control">
                    <CalendarDays size={16} />
                    <input
                      id="pr-end"
                      type="date"
                      className="admin-offer-input has-icon"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                      required
                    />
                  </span>
                </label>
              </div>
            </section>

            <section className="admin-offer-section">
              <h3 className="admin-offer-section-title">
                <Settings
                  size={14}
                  strokeWidth={1.7}
                  color="#D4AF37"
                  style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                />
                {sections.more}
              </h3>
              <div className="admin-offer-fields">
                <label className="admin-offer-field">
                  <span>{t("admin.promotions.fieldPriority")}</span>
                  <input
                    id="pr-priority"
                    type="number"
                    className="admin-offer-input"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value }))
                    }
                  />
                </label>
                <div className="admin-offer-field admin-offer-field-full">
                  <SingleImageField
                    label={t("admin.promotions.fieldImage")}
                    value={form.image}
                    onChange={(image) => setForm((f) => ({ ...f, image }))}
                    folder="promotions"
                  />
                </div>
                <label className="admin-offer-checkrow">
                  <input
                    type="checkbox"
                    checked={form.homepageVisible}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        homepageVisible: e.target.checked,
                      }))
                    }
                  />
                  {t("admin.promotions.showHomepage")}
                </label>
                <label className="admin-offer-checkrow">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                  />
                  {t("admin.promotions.fieldActive")}
                </label>
              </div>
            </section>
          </div>

          <div className="admin-offer-form-foot">
            <button
              type="button"
              className="admin-offer-btn-cancel"
              onClick={() => setModalOpen(false)}
            >
              {t("admin.promotions.cancel")}
            </button>
            <button
              type="submit"
              className="admin-offer-btn-save"
              disabled={saving}
            >
              {saving ? (
                t("admin.promotions.saving")
              ) : (
                <>
                  <Save
                    size={15}
                    strokeWidth={1.7}
                    style={{ marginInlineEnd: 6, verticalAlign: "middle" }}
                  />
                  {t("admin.promotions.save")}
                </>
              )}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
