"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { categoryLabel, countCategoryProducts } from "@/lib/catalog-categories";
import { invalidatePublicCache } from "@/lib/public-data-cache";
import type { CatalogCategory, CatalogCategoryNames, Product } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

type Translate = (path: string, vars?: Record<string, string | number>) => string;

type AdminCategory = CatalogCategory & { productCount?: number };

type EditorState = {
  id?: string;
  names: CatalogCategoryNames;
  showInMainCatalog: boolean;
};

const emptyNames = (): CatalogCategoryNames => ({ ar: "", he: "", en: "" });

function emptyEditor(): EditorState {
  return { names: emptyNames(), showInMainCatalog: false };
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
  onProductsChange?: () => void;
}) {
  const [items, setItems] = useState<AdminCategory[]>(categories);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteId, setDeleteId] = useState<string>("");
  const [reassignTo, setReassignTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setItems(categories);
    setEditor(null);
    setDeleteId("");
    setReassignTo("");
    setError("");
  }, [open, categories]);

  const deleting = items.find((item) => item.id === deleteId) || null;
  const assignedCount = deleting
    ? deleting.productCount ?? countCategoryProducts(products, deleting.id)
    : 0;

  const reassignOptions = useMemo(
    () => items.filter((item) => item.id !== deleteId),
    [items, deleteId],
  );

  function withCounts(list: CatalogCategory[]): AdminCategory[] {
    return list.map((item) => ({
      ...item,
      productCount: countCategoryProducts(products, item.id),
    }));
  }

  async function refresh() {
    const data = await apiFetch<{ categories: AdminCategory[] }>(
      "/api/catalog-categories?all=1",
    );
    const next = withCounts(data.categories || []);
    setItems(next);
    onChange(next);
    invalidatePublicCache("products:");
    onProductsChange?.();
  }

  async function saveEditor() {
    if (!editor) return;
    if (!editor.names.ar.trim() && !editor.names.he.trim() && !editor.names.en.trim()) {
      setError(t("admin.catalog.nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editor.id) {
        await apiFetch("/api/catalog-categories", {
          method: "PUT",
          body: JSON.stringify({
            id: editor.id,
            names: editor.names,
            showInMainCatalog: editor.showInMainCatalog,
          }),
        });
      } else {
        await apiFetch("/api/catalog-categories", {
          method: "POST",
          body: JSON.stringify({ names: editor.names }),
        });
      }
      await refresh();
      setEditor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.catalog.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(item: AdminCategory, showInMainCatalog: boolean) {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/catalog-categories", {
        method: "PUT",
        body: JSON.stringify({
          id: item.id,
          names: item.names,
          showInMainCatalog,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.catalog.saveError"));
    } finally {
      setSaving(false);
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
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/catalog-categories", {
        method: "DELETE",
        body: JSON.stringify(
          assignedCount > 0
            ? { id: deleting.id, reassignTo }
            : { id: deleting.id, removeMemberships: true },
        ),
      });
      await refresh();
      setDeleteId("");
      setReassignTo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.catalog.deleteError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title={t("admin.catalog.manageTitle")}
      onClose={onClose}
      wide
      icon={<FolderTree size={18} />}
    >
      {error ? (
        <p className="mb-3 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
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
      ) : editor ? (
        <div className="admin-cat-panel">
          <h3>{editor.id ? t("admin.catalog.edit") : t("admin.catalog.create")}</h3>
          {!editor.id ? <p className="admin-cat-hint">{t("admin.catalog.newHiddenHint")}</p> : null}
          <label className="admin-service-field">
            <span className="label">{t("admin.catalog.nameAr")}</span>
            <input
              className="input"
              value={editor.names.ar}
              maxLength={80}
              onChange={(event) =>
                setEditor({ ...editor, names: { ...editor.names, ar: event.target.value } })
              }
            />
          </label>
          <label className="admin-service-field">
            <span className="label">{t("admin.catalog.nameHe")}</span>
            <input
              className="input"
              value={editor.names.he}
              maxLength={80}
              onChange={(event) =>
                setEditor({ ...editor, names: { ...editor.names, he: event.target.value } })
              }
            />
          </label>
          <label className="admin-service-field">
            <span className="label">{t("admin.catalog.nameEn")}</span>
            <input
              className="input"
              value={editor.names.en}
              maxLength={80}
              onChange={(event) =>
                setEditor({ ...editor, names: { ...editor.names, en: event.target.value } })
              }
            />
          </label>
          {editor.id ? (
            <label className="admin-cat-toggle">
              <input
                type="checkbox"
                checked={editor.showInMainCatalog}
                onChange={(event) =>
                  setEditor({ ...editor, showInMainCatalog: event.target.checked })
                }
              />
              <span>{t("admin.catalog.showInMain")}</span>
            </label>
          ) : null}
          <div className="admin-service-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditor(null)}>
              {t("admin.catalog.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={saving}
              onClick={() => void saveEditor()}
            >
              {saving ? t("admin.catalog.saving") : t("admin.catalog.save")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              className="admin-products-add"
              onClick={() => setEditor(emptyEditor())}
            >
              <Plus size={14} strokeWidth={1.7} />
              {t("admin.catalog.create")}
            </button>
          </div>
          <ul className="admin-cat-list">
            {items.map((item) => {
              const count = item.productCount ?? countCategoryProducts(products, item.id);
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
                      onClick={() =>
                        setEditor({
                          id: item.id,
                          names: { ...item.names },
                          showInMainCatalog: item.showInMainCatalog,
                        })
                      }
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-bsvc-icon-action is-danger"
                      aria-label={t("admin.catalog.delete")}
                      disabled={Boolean(item.system)}
                      title={item.system ? t("admin.catalog.systemProtected") : t("admin.catalog.delete")}
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
    </AdminModal>
  );
}
