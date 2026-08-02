"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { hasPermission } from "@/lib/admin-permissions";
import type { AdminSession, Appointment, Customer } from "@/lib/types";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

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

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  notes: "",
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [role, setRole] = useState<AdminSession["role"]>("admin");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cData, aData, me] = await Promise.all([
        apiFetch<unknown>("/api/customers"),
        apiFetch<unknown>("/api/appointments").catch(() => []),
        apiFetch<{ user: AdminSession } | AdminSession>("/api/auth/me").catch(
          () => null
        ),
      ]);
      setCustomers(unwrapList<Customer>(cData, ["customers", "items", "data"]));
      setAppointments(unwrapList<Appointment>(aData, ["appointments", "items", "data"]));
      if (me) {
        const user = "user" in me ? me.user : me;
        setRole(user.role);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) {
      const key = a.customerId || a.customerEmail;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes || "",
    });
    setModalOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (editing) {
        const updated = await apiFetch<Customer | { customer: Customer }>(
          "/api/customers",
          { method: "PUT", body: JSON.stringify({ id: editing.id, ...form }) }
        );
        const row =
          updated && typeof updated === "object" && "customer" in updated
            ? updated.customer
            : (updated as Customer);
        setCustomers((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...c, ...row } : c))
        );
        setMessage("Customer updated");
      } else {
        const created = await apiFetch<Customer | { customer: Customer }>(
          "/api/customers",
          { method: "POST", body: JSON.stringify(form) }
        );
        const row =
          created && typeof created === "object" && "customer" in created
            ? created.customer
            : (created as Customer);
        setCustomers((prev) => [row, ...prev]);
        setMessage("Customer added");
      }
      setModalOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(c: Customer) {
    if (!hasPermission(role, "delete")) {
      setMessage("You do not have permission to delete");
      return;
    }
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await apiFetch(`/api/customers?id=${encodeURIComponent(c.id)}`, {
        method: "DELETE",
      });
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setMessage("Customer deleted");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        kicker="CRM"
        title="Customers"
        description="Customer records linked to bookings and orders."
        actions={
          <button type="button" className="btn btn-accent" onClick={openCreate}>
            <Plus size={16} /> Add customer
          </button>
        }
      />

      <div className="admin-card p-4">
        <div className="relative max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
          />
          <input
            className="input pl-10"
            placeholder="Search customers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
                <th>Name</th>
                <th>Contact</th>
                <th>Notes</th>
                <th>History</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-[var(--slate)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[var(--slate)]">
                    No customers found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const count = counts.get(c.id) || counts.get(c.email) || 0;
                  return (
                    <tr key={c.id}>
                      <td data-label="Name">
                        <div className="admin-cell-primary">{c.name}</div>
                        <div className="admin-cell-secondary">{c.email}</div>
                        <div className="admin-cell-secondary">{c.phone}</div>
                      </td>
                      <td data-label="Contact">
                        <div className="admin-muted text-sm">{c.email}</div>
                        <div className="text-xs text-[var(--slate)]">{c.phone}</div>
                      </td>
                      <td data-label="Notes" className="max-w-none truncate text-sm text-[var(--slate)] md:max-w-[200px]">
                        {c.notes || "—"}
                      </td>
                      <td data-label="History">
                        <Link
                          href={`/admin/appointments?customer=${encodeURIComponent(c.id)}`}
                          className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]"
                        >
                          {count} appointment{count === 1 ? "" : "s"}
                        </Link>
                      </td>
                      <td data-label="Actions" className="actions-cell">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            className="btn btn-ghost !min-h-11 !px-3 !text-xs"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                          {hasPermission(role, "delete") ? (
                            <button
                              type="button"
                              className="btn btn-ghost !min-h-11 !px-3 !text-xs text-[var(--danger)]"
                              onClick={() => void onDelete(c)}
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
        title={editing ? "Edit customer" : "Add customer"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="c-name">
              Name
            </label>
            <input
              id="c-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="c-email">
              Email
            </label>
            <input
              id="c-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="c-phone">
              Phone
            </label>
            <input
              id="c-phone"
              className="input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="c-notes">
              Notes
            </label>
            <textarea
              id="c-notes"
              className="textarea"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
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
