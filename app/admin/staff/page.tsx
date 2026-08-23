"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { apiFetch } from "@/lib/admin-api";
import type { ServiceType, StaffMember, UserRole } from "@/lib/types";

const SERVICE_TYPES: ServiceType[] = [
  "Eye Examination",
  "Prescription Glasses",
  "Sunglasses Fitting",
  "Contact Lenses",
  "Eyeglass Frames",
  "Vision Consultation",
  "Lens Fitting",
];

const ROLES: UserRole[] = ["admin", "employee", "receptionist"];

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

type StaffForm = {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  title: string;
  bio: string;
  image: string;
  specialties: ServiceType[];
  active: boolean;
  color: string;
};

const emptyForm = (): StaffForm => ({
  name: "",
  email: "",
  phone: "",
  role: "employee",
  title: "",
  bio: "",
  image: "",
  specialties: [],
  active: true,
  color: "#1a4a6b",
});

function fromStaff(s: StaffMember): StaffForm {
  return {
    name: s.name,
    email: s.email,
    phone: s.phone || "",
    role: s.role,
    title: s.title,
    bio: s.bio || "",
    image: s.image || "",
    specialties: s.specialties || [],
    active: s.active,
    color: s.color,
  };
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<unknown>("/api/staff");
      setStaff(unwrapList<StaffMember>(data, ["staff", "items", "data"]));
    } catch {
      try {
        const settings = await apiFetch<{ staff?: StaffMember[] } | StaffMember[]>(
          "/api/settings"
        );
        if (Array.isArray(settings)) setStaff(settings);
        else setStaff(settings.staff || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load staff");
      }
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

  function openEdit(s: StaffMember) {
    setEditing(s);
    setForm(fromStaff(s));
    setModalOpen(true);
  }

  function toggleSpecialty(service: ServiceType) {
    setForm((f) => ({
      ...f,
      specialties: f.specialties.includes(service)
        ? f.specialties.filter((s) => s !== service)
        : [...f.specialties, service],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      role: form.role,
      title: form.title,
      bio: form.bio || undefined,
      image: form.image || undefined,
      specialties: form.specialties,
      active: form.active,
      color: form.color,
    };
    try {
      if (editing) {
        const updated = await apiFetch<StaffMember | { staff: StaffMember }>(
          "/api/staff",
          { method: "PUT", body: JSON.stringify({ id: editing.id, ...payload }) }
        );
        const row =
          updated && typeof updated === "object" && "staff" in updated
            ? updated.staff
            : (updated as StaffMember);
        setStaff((prev) =>
          prev.map((s) => (s.id === editing.id ? { ...s, ...row } : s))
        );
        setMessage("Staff member updated");
      } else {
        const created = await apiFetch<StaffMember | { staff: StaffMember }>(
          "/api/staff",
          { method: "POST", body: JSON.stringify(payload) }
        );
        const row =
          created && typeof created === "object" && "staff" in created
            ? created.staff
            : (created as StaffMember);
        setStaff((prev) => [row, ...prev]);
        setMessage("Staff member added");
      }
      setModalOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: StaffMember) {
    setMessage("");
    try {
      const updated = await apiFetch<StaffMember | { staff: StaffMember }>(
        "/api/staff",
        {
          method: "PUT",
          body: JSON.stringify({
            id: s.id,
            ...fromStaff(s),
            active: !s.active,
          }),
        }
      );
      const row =
        updated && typeof updated === "object" && "staff" in updated
          ? updated.staff
          : (updated as StaffMember);
      setStaff((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, ...row, active: !s.active } : x))
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={UserRound}
        kicker="Team"
        title="Staff"
        description="Manage admin users and team access."
        actions={
          <button type="button" className="btn btn-accent" onClick={openCreate}>
            <Plus size={16} /> Add staff
          </button>
        }
      />

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

      {loading ? (
        <p className="text-[var(--slate)]">Loading staff…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <article key={s.id} className="admin-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: s.color }}
                  >
                    {s.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <h2 className="font-semibold text-[var(--ink)]">{s.name}</h2>
                    <p className="text-sm text-[var(--slate)]">{s.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost !min-h-9 !px-3 !text-xs"
                  onClick={() => openEdit(s)}
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>
              <p className="mb-3 text-sm text-[var(--slate)]">{s.email}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {s.specialties.map((sp) => (
                  <span key={sp} className="pill">
                    {sp}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--slate)]">
                  {s.role}
                </span>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={() => void toggleActive(s)}
                  />
                  Active
                </label>
              </div>
            </article>
          ))}
          {!staff.length ? (
            <p className="col-span-full text-[var(--slate)]">No staff members yet</p>
          ) : null}
        </div>
      )}

      <AdminModal
        open={modalOpen}
        title={editing ? "Edit staff" : "Add staff"}
        onClose={() => setModalOpen(false)}
        wide
      >
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="select"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as UserRole }))
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Calendar color</label>
            <input
              type="color"
              className="input !p-1"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Image URL</label>
            <input
              className="input"
              value={form.image}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Bio</label>
            <textarea
              className="textarea"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="label">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((service) => {
                const on = form.specialties.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    className={`btn !min-h-9 !px-3 !text-xs ${
                      on ? "btn-accent" : "btn-ghost"
                    }`}
                    onClick={() => toggleSpecialty(service)}
                  >
                    {service}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
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
