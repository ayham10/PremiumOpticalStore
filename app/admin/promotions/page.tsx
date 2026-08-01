"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import type { AdminSession, Promotion } from "@/lib/types";

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
  discount: string;
  couponCode: string;
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
  discount: "",
  couponCode: "",
  image: "",
  startDate: "",
  endDate: "",
  homepageVisible: true,
  priority: "1",
  active: true,
});

function fromPromo(p: Promotion): PromoForm {
  return {
    title: p.title,
    description: p.description,
    discount: p.discount,
    couponCode: p.couponCode || "",
    image: p.image || "",
    startDate: p.startDate,
    endDate: p.endDate,
    homepageVisible: p.homepageVisible,
    priority: String(p.priority),
    active: p.active,
  };
}

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, me] = await Promise.all([
        apiFetch<unknown>("/api/promotions"),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null
        ),
      ]);
      setItems(unwrapList<Promotion>(data, ["promotions", "items", "data"]));
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditing(p);
    setForm(fromPromo(p));
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      title: form.title,
      description: form.description,
      discount: form.discount,
      couponCode: form.couponCode || undefined,
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
        setMessage("Promotion updated");
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
        setMessage("Promotion created");
      }
      setModalOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(p: Promotion) {
    if (!hasPermission(role, "delete")) {
      setMessage("You do not have permission to delete");
      return;
    }
    if (!confirm(`Delete “${p.title}”?`)) return;
    try {
      await apiFetch(`/api/promotions?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      setMessage("Promotion deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1
            className="mt-1 text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Promotions
          </h1>
        </div>
        <button type="button" className="btn btn-accent" onClick={openCreate}>
          <Plus size={16} /> Add promotion
        </button>
      </header>

      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[#fdeaea] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="admin-card overflow-hidden">
        <div className="md:overflow-x-auto">
          <table className="table table-mobile-cards">
            <thead>
              <tr>
                <th>Title</th>
                <th>Discount</th>
                <th>Schedule</th>
                <th>Coupon</th>
                <th>Homepage</th>
                <th>Priority</th>
                <th>Active</th>
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
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-[var(--slate)]">
                    No promotions yet
                  </td>
                </tr>
              ) : (
                items
                  .slice()
                  .sort((a, b) => a.priority - b.priority)
                  .map((p) => (
                    <tr key={p.id}>
                      <td data-label="Title">
                        <div className="font-medium text-[var(--ink)]">{p.title}</div>
                        <div className="max-w-none truncate text-xs text-[var(--slate)] md:max-w-[220px]">
                          {p.description}
                        </div>
                      </td>
                      <td data-label="Discount">{p.discount}</td>
                      <td data-label="Schedule" className="text-sm">
                        {p.startDate} → {p.endDate}
                      </td>
                      <td data-label="Coupon">{p.couponCode || "—"}</td>
                      <td data-label="Homepage">{p.homepageVisible ? "Yes" : "No"}</td>
                      <td data-label="Priority">{p.priority}</td>
                      <td data-label="Active">
                        <span className={`pill ${p.active ? "" : "opacity-60"}`}>
                          {p.active ? "Active" : "Off"}
                        </span>
                      </td>
                      <td data-label="Actions" className="actions-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil size={14} />
                          </button>
                          {hasPermission(role, "delete") ? (
                            <button
                              type="button"
                              className="btn btn-ghost !min-h-11 !px-3 !text-xs text-[var(--danger)]"
                              onClick={() => void onDelete(p)}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminModal
        open={modalOpen}
        title={editing ? "Edit promotion" : "Add promotion"}
        onClose={() => setModalOpen(false)}
        wide
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pr-title">
              Title
            </label>
            <input
              id="pr-title"
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pr-desc">
              Description
            </label>
            <textarea
              id="pr-desc"
              className="textarea"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-discount">
              Discount
            </label>
            <input
              id="pr-discount"
              className="input"
              placeholder="20% or ₪100 off"
              value={form.discount}
              onChange={(e) =>
                setForm((f) => ({ ...f, discount: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-coupon">
              Coupon code
            </label>
            <input
              id="pr-coupon"
              className="input"
              value={form.couponCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, couponCode: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-start">
              Start date
            </label>
            <input
              id="pr-start"
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-end">
              End date
            </label>
            <input
              id="pr-end"
              type="date"
              className="input"
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-priority">
              Priority
            </label>
            <input
              id="pr-priority"
              type="number"
              className="input"
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-image">
              Image URL
            </label>
            <input
              id="pr-image"
              className="input"
              value={form.image}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
            <input
              type="checkbox"
              checked={form.homepageVisible}
              onChange={(e) =>
                setForm((f) => ({ ...f, homepageVisible: e.target.checked }))
              }
            />
            Show on homepage
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
