"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminProductCreateModal from "@/components/admin/AdminProductCreateModal";
import CategoryProductAssigner from "@/components/admin/CategoryProductAssigner";
import { useAdminSuccessNotice } from "@/components/admin/AdminSuccessNotice";
import { apiFetch } from "@/lib/admin-api";
import {
  applyCategoryAssignments,
  catalogCategorySaveMode,
  categoryLabel,
  countCategoryProducts,
  productBelongsToCategory,
  publicEligibleAssignedCount,
} from "@/lib/catalog-categories";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import type { CatalogCategory, CatalogCategoryNames, Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

type Translate = (path: string, vars?: Record<string, string | number>) => string;
type AdminCategory = CatalogCategory & { productCount?: number };
type WizardStep = 1 | 2 | 3;

type WizardState = {
  id?: string;
  names: CatalogCategoryNames;
  showInMainCatalog: boolean;
  selectedProductIds: string[];
  persisted: boolean;
};

const emptyNames = (): CatalogCategoryNames => ({ ar: "", he: "", en: "" });

function emptyWizard(): WizardState {
  return {
    names: emptyNames(),
    showInMainCatalog: false,
    selectedProductIds: [],
    persisted: false,
  };
}

function unwrapCategory(data: unknown): CatalogCategory | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.category && typeof obj.category === "object") {
    return obj.category as CatalogCategory;
  }
  if (typeof obj.id === "string" && obj.names) return data as CatalogCategory;
  return null;
}

async function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function CatalogCategoriesModal({
  open,
  locale,
  t,
  products,
  categories,
  onClose,
  onChange,
  onProductsChange,
}: {
  open: boolean;
  locale: Locale | string;
  t: Translate;
  products: Product[];
  categories: AdminCategory[];
  onClose: () => void;
  onChange: (categories: AdminCategory[]) => void;
  onProductsChange?: () => void | Promise<void>;
}) {
  const [items, setItems] = useState<AdminCategory[]>(categories);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [deleteId, setDeleteId] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const savingRef = useRef(false);
  const wizardRef = useRef<WizardState | null>(null);
  const { notifySaved } = useAdminSuccessNotice();
  wizardRef.current = wizard;

  useEffect(() => {
    if (!open) {
      setWizard(null);
      setStep(1);
      setDeleteId("");
      setError("");
      setMessage("");
      setSaving(false);
      savingRef.current = false;
      return;
    }
    setItems(categories);
    setLocalProducts((prev) => {
      if (!wizardRef.current) return products;
      const incoming = new Set(products.map((item) => item.id));
      const extras = prev.filter((item) => !incoming.has(item.id));
      return extras.length ? [...extras, ...products] : products;
    });
  }, [open, categories, products]);

  const deleting = items.find((item) => item.id === deleteId) || null;
  const assignedCount = deleting
    ? deleting.productCount ?? countCategoryProducts(localProducts, deleting.id)
    : 0;
  const reassignOptions = useMemo(
    () => items.filter((item) => item.id !== deleteId),
    [items, deleteId],
  );

  function typeLabel(id: string): string {
    const found = items.find((item) => item.id === id);
    if (found) return categoryLabel(found, locale);
    const key = `shop.categories.${id}`;
    const label = t(key);
    return label === key ? id : label;
  }

  async function refreshLists(nextProducts?: Product[]) {
    const data = await withTimeout(
      apiFetch<{ categories: AdminCategory[] }>("/api/catalog-categories?all=1"),
    );
    const source = nextProducts || localProducts;
    const next = (data.categories || []).map((item) => ({
      ...item,
      productCount:
        nextProducts
          ? countCategoryProducts(nextProducts, item.id)
          : item.productCount ?? countCategoryProducts(source, item.id),
    }));
    setItems(next);
    onChange(next);
    invalidatePublicCache("products:");
  }

  function namesReady(names: CatalogCategoryNames): boolean {
    return Boolean(names.ar.trim() || names.he.trim() || names.en.trim());
  }

  async function persistWizard(
    draft: WizardState,
    includeAssignments: boolean,
  ): Promise<WizardState> {
    if (!namesReady(draft.names)) {
      throw new Error(t("admin.catalog.nameRequired"));
    }
    const payload = {
      names: draft.names,
      showInMainCatalog: draft.showInMainCatalog,
      ...(includeAssignments ? { assignedProductIds: draft.selectedProductIds } : {}),
    };
    if (catalogCategorySaveMode(draft.id) === "update" && draft.id) {
      const response = await withTimeout(
        apiFetch<{
          category?: CatalogCategory;
          assignedProductIds?: string[];
        }>("/api/catalog-categories", {
          method: "PUT",
          body: JSON.stringify({ id: draft.id, ...payload }),
        }),
      );
      const updated = unwrapCategory(response);
      if (!updated) throw new Error(t("admin.catalog.saveError"));
      if (includeAssignments && Array.isArray(response.assignedProductIds)) {
        const expected = [...draft.selectedProductIds].sort();
        const persisted = [...response.assignedProductIds].sort();
        const missing = expected.some((id) => !persisted.includes(id));
        if (missing) throw new Error(t("admin.catalog.saveError"));
      }
      return { ...draft, id: updated.id, persisted: true };
    }
    const created = unwrapCategory(
      await withTimeout(
        apiFetch("/api/catalog-categories", {
          method: "POST",
          body: JSON.stringify({
            names: draft.names,
            showInMainCatalog: draft.showInMainCatalog,
          }),
        }),
      ),
    );
    if (!created?.id) throw new Error(t("admin.catalog.saveError"));
    if (includeAssignments && draft.selectedProductIds.length) {
      await withTimeout(
        apiFetch("/api/catalog-categories", {
          method: "PUT",
          body: JSON.stringify({
            id: created.id,
            names: draft.names,
            showInMainCatalog: draft.showInMainCatalog,
            assignedProductIds: draft.selectedProductIds,
          }),
        }),
      );
    }
    return { ...draft, id: created.id, persisted: true };
  }

  async function runSave(task: () => Promise<void>): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await task();
      return true;
    } catch (err) {
      const text =
        err instanceof Error && err.message === "TIMEOUT"
          ? t("admin.catalog.saveTimeout")
          : err instanceof Error
            ? err.message
            : t("admin.catalog.saveError");
      setError(text);
      throw err;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function goNext() {
    if (!wizard) return;
    if (step === 1) {
      if (!namesReady(wizard.names)) {
        setError(t("admin.catalog.nameRequired"));
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      try {
        const completed = await runSave(async () => {
          const saved = await persistWizard(wizardRef.current || wizard, false);
          setWizard(saved);
          await refreshLists();
        });
        if (!completed) {
          setError(t("admin.catalog.saveBusy"));
          return;
        }
        setStep(3);
      } catch {
        /* error already set */
      }
    }
  }

  async function finishWizard() {
    const draft = wizardRef.current || wizard;
    if (!draft) return;
    try {
      const completed = await runSave(async () => {
        const saved = await persistWizard(draft, true);
        if (!saved.id) throw new Error(t("admin.catalog.saveError"));
        const nextProducts = applyCategoryAssignments(
          localProducts,
          saved.id,
          saved.selectedProductIds,
        );
        setLocalProducts(nextProducts);
        setWizard(saved);
        await refreshLists(nextProducts);
        await onProductsChange?.();
      });
      if (!completed) {
        setError(t("admin.catalog.saveBusy"));
        return;
      }
      setWizard(null);
      setStep(1);
      setMessage("");
      notifySaved({
        title: t("admin.catalog.savedTitle"),
        detail: t("admin.catalog.savedDetail"),
      });
    } catch {
      /* stay on wizard with error */
    }
  }

  async function toggleVisibility(item: AdminCategory, showInMainCatalog: boolean) {
    try {
      await runSave(async () => {
        await withTimeout(
          apiFetch("/api/catalog-categories", {
            method: "PUT",
            body: JSON.stringify({
              id: item.id,
              names: item.names,
              showInMainCatalog,
            }),
          }),
        );
        await refreshLists();
      });
    } catch {
      /* error already set */
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    if (deleting.system) {
      setError(t("admin.catalog.systemProtected"));
      return;
    }
    if (assignedCount > 0 && !reassignTo) {
      setError(t("admin.catalog.deleteBlocked"));
      return;
    }
    try {
      await runSave(async () => {
        await withTimeout(
          apiFetch("/api/catalog-categories", {
            method: "DELETE",
            body: JSON.stringify(
              assignedCount > 0
                ? { id: deleting.id, reassignTo }
                : { id: deleting.id, removeMemberships: true },
            ),
          }),
        );
        await refreshLists();
        onProductsChange?.();
        setDeleteId("");
        setReassignTo("");
      });
    } catch {
      /* error already set */
    }
  }

  function openCreate() {
    setWizard(emptyWizard());
    setStep(1);
    setError("");
    setMessage("");
  }

  function openEdit(item: AdminCategory) {
    setWizard({
      id: item.id,
      names: { ...item.names },
      showInMainCatalog: item.showInMainCatalog,
      selectedProductIds: localProducts
        .filter((product) => productBelongsToCategory(product, item.id))
        .map((product) => product.id),
      persisted: true,
    });
    setStep(1);
    setError("");
    setMessage("");
  }

  const stepTitle =
    step === 1
      ? t("admin.catalog.stepInfo")
      : step === 2
        ? t("admin.catalog.stepVisibility")
        : t("admin.catalog.stepProducts");

  return (
    <AdminModal
      open={open}
      title={wizard ? stepTitle : t("admin.catalog.manageTitle")}
      onClose={onClose}
      wide
      icon={<FolderTree size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message && !wizard ? (
        <p className="mb-3 rounded-xl border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.12)] px-3 py-2 text-sm text-[#d4af37]">
          {message}
        </p>
      ) : null}

      {deleteId && deleting ? (
        <div className="admin-cat-panel">
          <h3>{t("admin.catalog.deleteTitle")}</h3>
          <p>
            {t("admin.catalog.deleteConfirm", {
              name: categoryLabel(deleting, locale),
              count: assignedCount,
            })}
          </p>
          {assignedCount > 0 ? (
            <label className="admin-service-field">
              <span className="label">{t("admin.catalog.reassignTo")}</span>
              <select
                className="input"
                value={reassignTo}
                onChange={(event) => setReassignTo(event.target.value)}
              >
                <option value="">{t("admin.catalog.chooseCategory")}</option>
                {reassignOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {categoryLabel(item, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="admin-cat-hint">{t("admin.catalog.deleteEmptyHint")}</p>
          )}
          <div className="admin-service-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDeleteId("");
                setReassignTo("");
                setError("");
              }}
            >
              {t("admin.catalog.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={saving || (assignedCount > 0 && !reassignTo)}
              onClick={() => void confirmDelete()}
            >
              {saving ? t("admin.catalog.saving") : t("admin.catalog.delete")}
            </button>
          </div>
        </div>
      ) : wizard ? (
        <div className="admin-cat-panel">
          <ol className="admin-cat-progress" aria-label={t("admin.catalog.progress")}>
            {[1, 2, 3].map((value) => (
              <li
                key={value}
                className={
                  value === step ? "is-active" : value < step ? "is-done" : ""
                }
              >
                <span>{value}</span>
                {value === 1
                  ? t("admin.catalog.stepInfoShort")
                  : value === 2
                    ? t("admin.catalog.stepVisibilityShort")
                    : t("admin.catalog.stepProductsShort")}
              </li>
            ))}
          </ol>

          {step === 1 ? (
            <>
              <label className="admin-service-field">
                <span className="label">{t("admin.catalog.nameAr")}</span>
                <input
                  className="input"
                  value={wizard.names.ar}
                  maxLength={80}
                  onChange={(event) =>
                    setWizard({
                      ...wizard,
                      names: { ...wizard.names, ar: event.target.value },
                    })
                  }
                />
              </label>
              <label className="admin-service-field">
                <span className="label">{t("admin.catalog.nameHe")}</span>
                <input
                  className="input"
                  value={wizard.names.he}
                  maxLength={80}
                  onChange={(event) =>
                    setWizard({
                      ...wizard,
                      names: { ...wizard.names, he: event.target.value },
                    })
                  }
                />
              </label>
              <label className="admin-service-field">
                <span className="label">{t("admin.catalog.nameEn")}</span>
                <input
                  className="input"
                  value={wizard.names.en}
                  maxLength={80}
                  onChange={(event) =>
                    setWizard({
                      ...wizard,
                      names: { ...wizard.names, en: event.target.value },
                    })
                  }
                />
              </label>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label className="admin-cat-toggle">
                <input
                  type="checkbox"
                  checked={wizard.showInMainCatalog}
                  onChange={(event) =>
                    setWizard({ ...wizard, showInMainCatalog: event.target.checked })
                  }
                />
                <span>{t("admin.catalog.showInMainPage")}</span>
              </label>
              <p className="admin-cat-hint">
                {wizard.showInMainCatalog
                  ? t("admin.catalog.visibleHint")
                  : t("admin.catalog.hiddenHint")}
              </p>
            </>
          ) : null}

          {step === 3 && wizard.id ? (
            <>
              <CategoryProductAssigner
                products={localProducts}
                categories={items}
                locale={locale}
                categoryId={wizard.id}
                selectedIds={wizard.selectedProductIds}
                typeLabel={typeLabel}
                t={t}
                onChange={(ids) =>
                  setWizard((prev) =>
                    prev ? { ...prev, selectedProductIds: ids } : prev,
                  )
                }
                onAddNew={() => setCreateOpen(true)}
              />
              {wizard.selectedProductIds.length > 0 &&
              publicEligibleAssignedCount(
                localProducts.filter((product) =>
                  wizard.selectedProductIds.includes(product.id),
                ),
                wizard.id,
              ) === 0 ? (
                <p className="admin-cat-hint">{t("admin.catalog.nonePubliclyEligible")}</p>
              ) : null}
            </>
          ) : null}

          <div className="admin-service-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={saving}
              onClick={() => {
                if (step === 1) {
                  setWizard(null);
                  setError("");
                  return;
                }
                setStep((prev) => (prev === 3 ? 2 : 1));
              }}
            >
              {step === 1 ? t("admin.catalog.cancel") : t("admin.catalog.back")}
            </button>
            {step < 3 ? (
            <button
              type="button"
              className="btn btn-accent"
              disabled={saving}
              aria-busy={saving}
              onClick={() => void goNext()}
            >
              {saving ? t("admin.catalog.saving") : t("admin.catalog.next")}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-accent"
              disabled={saving}
              aria-busy={saving}
              onClick={() => void finishWizard()}
            >
              {saving ? t("admin.catalog.saving") : t("admin.catalog.finish")}
            </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <button type="button" className="admin-products-add" onClick={openCreate}>
              <Plus size={14} strokeWidth={1.7} />
              {t("admin.catalog.create")}
            </button>
          </div>
          <ul className="admin-cat-list">
            {items.map((item) => {
              const count = item.productCount ?? countCategoryProducts(localProducts, item.id);
              return (
                <li key={item.id} className="admin-cat-row">
                  <div className="admin-cat-row-copy">
                    <strong>{categoryLabel(item, locale)}</strong>
                    <span>
                      {t("admin.catalog.productCount", { count })}
                      {item.system ? ` · ${t("admin.catalog.system")}` : ""}
                    </span>
                  </div>
                  <label className="admin-cat-toggle is-compact">
                    <input
                      type="checkbox"
                      checked={item.showInMainCatalog}
                      disabled={saving}
                      onChange={(event) => void toggleVisibility(item, event.target.checked)}
                    />
                    <span>
                      {item.showInMainCatalog
                        ? t("admin.catalog.visible")
                        : t("admin.catalog.hidden")}
                    </span>
                  </label>
                  <div className="admin-cat-row-actions">
                    <button
                      type="button"
                      className="admin-bsvc-icon-action"
                      aria-label={t("admin.catalog.edit")}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-bsvc-icon-action is-danger"
                      aria-label={t("admin.catalog.delete")}
                      disabled={Boolean(item.system)}
                      title={
                        item.system
                          ? t("admin.catalog.systemProtected")
                          : t("admin.catalog.delete")
                      }
                      onClick={() => {
                        setDeleteId(item.id);
                        setReassignTo("");
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AdminProductCreateModal
        open={createOpen}
        t={t}
        stacked
        preselectCategoryId={wizard?.id}
        onClose={() => setCreateOpen(false)}
        onCreated={(product) => {
          setLocalProducts((prev) => {
            if (prev.some((item) => item.id === product.id)) return prev;
            return [product, ...prev];
          });
          if (wizard) {
            const nextIds = wizard.selectedProductIds.includes(product.id)
              ? wizard.selectedProductIds
              : [...wizard.selectedProductIds, product.id];
            setWizard({ ...wizard, selectedProductIds: nextIds });
          }
          setCreateOpen(false);
        }}
      />
    </AdminModal>
  );
}
