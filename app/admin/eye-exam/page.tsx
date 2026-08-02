"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Plus, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/lib/admin-api";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type {
  ClinicAppointmentType,
  EyeExamAppointmentStatus,
} from "@/lib/types";

type SlotRow = {
  id: string;
  time: string;
  isEnabled: boolean;
  isBooked?: boolean;
};

type DayRow = {
  id: string;
  date: string;
  label: string;
  isOpen: boolean;
  slots: SlotRow[];
  services?: ClinicAppointmentType[];
};

type AppointmentRow = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: ClinicAppointmentType;
  dateLabel: string;
  status: EyeExamAppointmentStatus;
  smsStatus: string;
  smsError?: string;
  language: string;
  createdAt: string;
};

const STATUSES: EyeExamAppointmentStatus[] = [
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
];

function AdminEyeExamPageInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: "availability" | "appointments" =
    tabParam === "appointments" ? "appointments" : "availability";

  function setTab(next: "availability" | "appointments") {
    router.replace(`/admin/eye-exam?tab=${next}`);
  }

  const [days, setDays] = useState<DayRow[]>([]);
  const [defaultTimes, setDefaultTimes] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newDate, setNewDate] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [newServices, setNewServices] = useState<ClinicAppointmentType[]>([
    "eye_exam",
    "contact_lens_fitting",
    "frame_consultation",
    "sunglasses_consultation",
  ]);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    appointmentDate: "",
    appointmentTime: "",
    appointmentType: "eye_exam" as ClinicAppointmentType,
    status: "confirmed" as EyeExamAppointmentStatus,
  });

  const selected = useMemo(
    () => days.find((d) => d.id === selectedId) || null,
    [days, selectedId]
  );

  const editDaySlots = useMemo(() => {
    if (!editForm.appointmentDate) return [] as string[];
    const day = days.find((d) => d.date === editForm.appointmentDate);
    if (!day) return [] as string[];
    return day.slots
      .filter((s) => s.isEnabled || s.time === editForm.appointmentTime)
      .map((s) => s.time);
  }, [days, editForm.appointmentDate, editForm.appointmentTime]);

  const loadAvailability = useCallback(async () => {
    const data = await apiFetch<{
      days: DayRow[];
      defaultSlotTimes: string[];
    }>("/api/admin/eye-exam/availability");
    setDays(data.days || []);
    setDefaultTimes(data.defaultSlotTimes || []);
    setSelectedId((prev) => {
      if (prev && data.days?.some((d) => d.id === prev)) return prev;
      return data.days?.[0]?.id || "";
    });
  }, []);

  const loadAppointments = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (dateFilter) params.set("date", dateFilter);
    if (query.trim()) params.set("q", query.trim());
    const data = await apiFetch<{ appointments: AppointmentRow[] }>(
      `/api/admin/eye-exam/appointments?${params.toString()}`
    );
    setAppointments(data.appointments || []);
  }, [dateFilter, query, statusFilter, typeFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadAvailability(), loadAppointments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadAppointments, loadAvailability]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createDay(e: FormEvent) {
    e.preventDefault();
    if (!newDate || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/api/admin/eye-exam/availability", {
        method: "POST",
        body: JSON.stringify({
          date: newDate,
          isOpen: true,
          copyFromDate: copyFrom || undefined,
          services: newServices,
        }),
      });
      setNewDate("");
      setMessage("Availability date added");
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add date");
    } finally {
      setBusy(false);
    }
  }

  async function patchDay(body: Record<string, unknown>) {
    if (!selected || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/api/admin/eye-exam/availability", {
        method: "PATCH",
        body: JSON.stringify({ id: selected.id, ...body }),
      });
      setMessage("Availability updated");
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDay(id: string) {
    if (busy) return;
    if (!window.confirm("Disable/delete this date? Active bookings block deletion.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/admin/eye-exam/availability?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setMessage("Date removed");
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateAppointmentStatus(
    id: string,
    status: EyeExamAppointmentStatus
  ) {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/admin/eye-exam/appointments", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      });
      setMessage("Appointment updated");
      await loadAppointments();
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(row: AppointmentRow) {
    setEditing(row);
    setEditForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      appointmentDate: row.appointmentDate,
      appointmentTime: row.appointmentTime,
      appointmentType: row.appointmentType || "eye_exam",
      status: row.status,
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/admin/eye-exam/appointments", {
        method: "PATCH",
        body: JSON.stringify({ id: editing.id, ...editForm }),
      });
      setMessage("Appointment saved");
      setEditing(null);
      await loadAppointments();
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Bookings</p>
          <h1
            className="mt-1 text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {tab === "availability"
              ? t("admin.sidebar.availability")
              : t("admin.sidebar.appointments")}
          </h1>
          <p className="mt-1 text-sm text-[var(--slate)]">
            {tab === "availability"
              ? "Open dates, time slots, and service availability for online booking."
              : "Search, filter, and manage customer bookings."}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost inline-flex items-center gap-2"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            tab === "availability"
              ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
              : "border-[var(--line)]"
          }`}
          onClick={() => setTab("availability")}
        >
          Availability
        </button>
        <button
          type="button"
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            tab === "appointments"
              ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
              : "border-[var(--line)]"
          }`}
          onClick={() => setTab("appointments")}
        >
          Appointments
        </button>
      </div>

      {message ? (
        <p className="rounded-xl border border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.12)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--slate)]">{t("common.loading")}</p>
      ) : null}

      {tab === "availability" ? (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="admin-card rounded-2xl p-4">
            <h2 className="text-lg font-semibold">Dates</h2>
            <form onSubmit={createDay} className="mt-3 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                Add date
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                Copy schedule from
                <select
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                >
                  <option value="">Default slots</option>
                  {days.map((d) => (
                    <option key={d.id} value={d.date}>
                      {d.label} ({d.date})
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="space-y-1 text-xs">
                <legend className="font-semibold uppercase tracking-wide text-[var(--slate)]">
                  Services for this date
                </legend>
                {(
                  [
                    "eye_exam",
                    "contact_lens_fitting",
                    "frame_consultation",
                    "sunglasses_consultation",
                  ] as ClinicAppointmentType[]
                ).map((service) => (
                  <label
                    key={service}
                    className="flex items-center gap-2 text-sm normal-case tracking-normal"
                  >
                    <input
                      type="checkbox"
                      checked={newServices.includes(service)}
                      onChange={(e) =>
                        setNewServices((prev) =>
                          e.target.checked
                            ? Array.from(new Set([...prev, service]))
                            : prev.filter((s) => s !== service),
                        )
                      }
                    />
                    {t(`clinicBooking.services.${service}`)}
                  </label>
                ))}
              </fieldset>
              <button
                type="submit"
                className="btn btn-primary inline-flex w-full items-center justify-center gap-2"
                disabled={busy || newServices.length === 0}
              >
                <Plus size={16} />
                Add date
              </button>
            </form>

            <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
              {days.map((day) => (
                <li key={day.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(day.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-start text-sm ${
                      selectedId === day.id
                        ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                        : "hover:bg-[var(--mist)]"
                    }`}
                  >
                    <span>
                      <strong className="block">{day.label}</strong>
                      <span className="text-xs opacity-70">{day.date}</span>
                      <span className="mt-0.5 block text-[0.65rem] opacity-70">
                        {!day.services || day.services.length === 0
                          ? "Shared"
                          : day.services
                              .map((s) => t(`clinicBooking.services.${s}`))
                              .join(" · ")}
                      </span>
                    </span>
                    <span className="text-xs font-semibold uppercase">
                      {day.isOpen ? "Open" : "Closed"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-card rounded-2xl p-4 md:p-5">
            {!selected ? (
              <p className="text-sm text-[var(--slate)]">Select or add a date.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{selected.label}</h2>
                    <p className="text-sm text-[var(--slate)]">{selected.date}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void patchDay({ isOpen: !selected.isOpen })}
                    >
                      {selected.isOpen ? "Mark closed" : "Mark open"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost inline-flex items-center gap-2"
                      disabled={busy}
                      onClick={() => {
                        setNewDate("");
                        setCopyFrom(selected.date);
                      }}
                    >
                      <Copy size={15} />
                      Use as copy source
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-[var(--danger)]"
                      disabled={busy}
                      onClick={() => void deleteDay(selected.id)}
                    >
                      Delete date
                    </button>
                  </div>
                </div>

                <fieldset className="mt-4 flex flex-wrap gap-4 text-sm">
                  <legend className="mb-1 w-full text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                    Services (all checked = shared slots)
                  </legend>
                  {(
                    [
                      "eye_exam",
                      "contact_lens_fitting",
                      "frame_consultation",
                      "sunglasses_consultation",
                    ] as ClinicAppointmentType[]
                  ).map((service) => {
                      const allTypes: ClinicAppointmentType[] = [
                        "eye_exam",
                        "contact_lens_fitting",
                        "frame_consultation",
                        "sunglasses_consultation",
                      ];
                      const active =
                        !selected.services ||
                        selected.services.length === 0 ||
                        selected.services.includes(service);
                      return (
                        <label key={service} className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={active}
                            disabled={busy}
                            onChange={(e) => {
                              const current =
                                !selected.services || selected.services.length === 0
                                  ? allTypes
                                  : selected.services;
                              const next = e.target.checked
                                ? Array.from(new Set([...current, service]))
                                : current.filter((s) => s !== service);
                              void patchDay({
                                services: next.length ? next : null,
                              });
                            }}
                          />
                          {t(`clinicBooking.services.${service}`)}
                        </label>
                      );
                    })}
                </fieldset>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    disabled={busy}
                    onClick={() =>
                      void patchDay({
                        slots: defaultTimes.map((time) => ({
                          time,
                          isEnabled: true,
                        })),
                      })
                    }
                  >
                    Enable all default slots
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    disabled={busy}
                    onClick={() =>
                      void patchDay({
                        slots: selected.slots.map((s) => ({
                          ...s,
                          isEnabled: false,
                        })),
                      })
                    }
                  >
                    Disable all slots
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {selected.slots.map((slot) => {
                    const state = slot.isBooked
                      ? "Booked"
                      : slot.isEnabled
                        ? "Available"
                        : "Disabled";
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={busy || slot.isBooked}
                        onClick={() =>
                          void patchDay({
                            toggleTime: {
                              time: slot.time,
                              isEnabled: !slot.isEnabled,
                            },
                          })
                        }
                        className={`rounded-xl border px-3 py-3 text-start text-sm transition ${
                          slot.isBooked
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : slot.isEnabled
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : "border-[var(--line)] bg-[var(--mist)] text-[var(--slate)]"
                        }`}
                      >
                        <strong className="block text-base">{slot.time}</strong>
                        <span className="text-xs uppercase tracking-wide">{state}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <section className="admin-card rounded-2xl p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
              Search
              <div className="relative mt-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] py-2 ps-9 pe-3 text-sm"
                  placeholder="Name, email, phone"
                />
              </div>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
              Date
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="mt-1 block rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-1 block rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                <option value="eye_exam">{t("clinicBooking.services.eye_exam")}</option>
                <option value="contact_lens_fitting">
                  {t("clinicBooking.services.contact_lens_fitting")}
                </option>
                <option value="frame_consultation">
                  {t("clinicBooking.services.frame_consultation")}
                </option>
                <option value="sunglasses_consultation">
                  {t("clinicBooking.services.sunglasses_consultation")}
                </option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void loadAppointments()}
            >
              Apply
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-start text-xs uppercase tracking-wide text-[var(--slate)]">
                  <th className="px-2 py-3">Customer</th>
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Phone</th>
                  <th className="px-2 py-3">Email</th>
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Time</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">SMS</th>
                  <th className="px-2 py-3">Created</th>
                  <th className="px-2 py-3">Lang</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-8 text-center text-[var(--slate)]">
                      {t("admin.common.noResults")}
                    </td>
                  </tr>
                ) : (
                  appointments.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line)] align-top">
                      <td className="px-2 py-3 font-medium">{row.fullName}</td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {t(`clinicBooking.services.${row.appointmentType || "eye_exam"}`)}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">{row.phone}</td>
                      <td className="px-2 py-3">{row.email}</td>
                      <td className="px-2 py-3 whitespace-nowrap">{row.dateLabel}</td>
                      <td className="px-2 py-3">{row.appointmentTime}</td>
                      <td className="px-2 py-3">
                        <select
                          value={row.status}
                          disabled={busy}
                          onChange={(e) =>
                            void updateAppointmentStatus(
                              row.id,
                              e.target.value as EyeExamAppointmentStatus
                            )
                          }
                          className="rounded-lg border border-[var(--line)] px-2 py-1"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-3">
                        <span className="block">{row.smsStatus}</span>
                        {row.smsError ? (
                          <span className="mt-1 block text-xs text-red-600">
                            {row.smsError}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-[var(--slate)]">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-3 text-xs text-[var(--slate)]">
                        {row.language.toUpperCase()}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="text-start text-xs font-semibold text-[var(--accent)]"
                            onClick={() => openEdit(row)}
                          >
                            Edit / Reschedule
                          </button>
                          {row.status !== "cancelled" ? (
                            <button
                              type="button"
                              className="text-start text-xs font-semibold text-[var(--danger)]"
                              disabled={busy}
                              onClick={() =>
                                void updateAppointmentStatus(row.id, "cancelled")
                              }
                            >
                              Cancel
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
        </section>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="admin-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
          >
            <h3
              className="text-xl text-[var(--ink)]"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              Edit appointment
            </h3>
            <p className="mt-1 text-sm text-[var(--slate)]">{editing.fullName}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                First name
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.firstName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                Last name
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.lastName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)] sm:col-span-2">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)] sm:col-span-2">
                Phone
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)] sm:col-span-2">
                Service
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.appointmentType}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      appointmentType: e.target.value as ClinicAppointmentType,
                    }))
                  }
                >
                  {(
                    [
                      "eye_exam",
                      "contact_lens_fitting",
                      "frame_consultation",
                      "sunglasses_consultation",
                    ] as ClinicAppointmentType[]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {t(`clinicBooking.services.${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.appointmentDate}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      appointmentDate: e.target.value,
                      appointmentTime: "",
                    }))
                  }
                  required
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                Time
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.appointmentTime}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      appointmentTime: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select time</option>
                  {editDaySlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                  {editForm.appointmentTime &&
                  !editDaySlots.includes(editForm.appointmentTime) ? (
                    <option value={editForm.appointmentTime}>
                      {editForm.appointmentTime}
                    </option>
                  ) : null}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)] sm:col-span-2">
                Status
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      status: e.target.value as EyeExamAppointmentStatus,
                    }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Close
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminEyeExamPage() {
  return (
    <Suspense fallback={<p className="text-[var(--slate)]">Loading…</p>}>
      <AdminEyeExamPageInner />
    </Suspense>
  );
}
