"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Search } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AvailabilityCalendarPanel from "@/components/admin/AvailabilityCalendarPanel";
import ManualBookingModal from "@/components/admin/ManualBookingModal";
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
  bookedBy?: string;
  bookedId?: string;
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

function bookingStatusLabel(
  t: (key: string) => string,
  status: string
): string {
  const map: Record<string, string> = {
    pending: "admin.bookings.statusPending",
    confirmed: "admin.bookings.statusConfirmed",
    completed: "admin.bookings.statusCompleted",
    cancelled: "admin.bookings.statusCancelled",
    "no-show": "admin.bookings.statusNoShow",
    no_show: "admin.bookings.statusNoShow",
  };
  const key = map[status];
  if (!key) return status;
  const label = t(key);
  return label === key ? status : label;
}

function AdminEyeExamPageInner() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: "availability" | "appointments" =
    tabParam === "appointments" ? "appointments" : "availability";
  const bookParam = searchParams.get("book");
  const [bookOpen, setBookOpen] = useState(false);

  function setTab(next: "availability" | "appointments") {
    router.replace(`/admin/eye-exam?tab=${next}`);
  }

  function openManualBooking() {
    setBookOpen(true);
    router.replace("/admin/eye-exam?tab=appointments&book=1");
  }

  function closeManualBooking() {
    setBookOpen(false);
    router.replace("/admin/eye-exam?tab=appointments");
  }

  useEffect(() => {
    if (bookParam === "1") {
      setBookOpen(true);
      if (tabParam !== "appointments") {
        router.replace("/admin/eye-exam?tab=appointments&book=1");
      }
    }
  }, [bookParam, tabParam, router]);

  const [days, setDays] = useState<DayRow[]>([]);
  const [defaultTimes, setDefaultTimes] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
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

  async function createDay(payload: {
    date: string;
    services: ClinicAppointmentType[];
    copyFromDate?: string;
  }) {
    if (!payload.date || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const created = await apiFetch<{ day?: DayRow }>(
        "/api/admin/eye-exam/availability",
        {
          method: "POST",
          body: JSON.stringify({
            date: payload.date,
            isOpen: true,
            copyFromDate: payload.copyFromDate || undefined,
            services: payload.services,
          }),
        },
      );
      setMessage("Availability date added");
      await loadAvailability();
      if (created.day?.id) setSelectedId(created.day.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add date");
    } finally {
      setBusy(false);
    }
  }

  async function patchDay(body: Record<string, unknown>) {
    const targetId =
      (typeof body.id === "string" && body.id) || selected?.id || selectedId;
    if (!targetId || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/api/admin/eye-exam/availability", {
        method: "PATCH",
        body: JSON.stringify({ id: targetId, ...body }),
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
      <AdminPageHeader
        kicker="Bookings"
        title={
          tab === "availability"
            ? t("admin.sidebar.availability")
            : t("admin.sidebar.appointments")
        }
        description={
          tab === "availability"
            ? "Open dates, time slots, and service availability for online booking."
            : "Search, filter, and manage customer bookings."
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost inline-flex items-center gap-2"
              onClick={() => void refresh()}
              disabled={loading || busy}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-accent inline-flex items-center gap-2"
              onClick={openManualBooking}
            >
              <Plus size={16} />
              New Booking
            </button>
          </>
        }
      />

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
        <AvailabilityCalendarPanel
          days={days}
          defaultTimes={defaultTimes}
          busy={busy}
          selectedId={selectedId}
          onSelectDayId={setSelectedId}
          onPatchDay={async (body) => {
            await patchDay(body);
          }}
          onCreateDay={async (payload) => {
            await createDay(payload);
          }}
          onDeleteDay={async (id) => {
            await deleteDay(id);
          }}
        />
      ) : (
        <section className="admin-bookings">
          <div className="admin-bookings-search">
            <Search size={18} className="admin-bookings-search-icon" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="admin-bookings-search-input"
              placeholder={t("admin.bookings.searchPlaceholder")}
              aria-label={t("admin.bookings.searchPlaceholder")}
            />
          </div>

          <div className="admin-bookings-filters">
            <label className="admin-filter-chip">
              <span className="admin-filter-chip-label">
                {t("admin.bookings.filterStatus")}
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-filter-chip-control"
              >
                <option value="all">{t("admin.bookings.allStatuses")}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {bookingStatusLabel(t, s)}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-filter-chip">
              <span className="admin-filter-chip-label">
                {t("admin.bookings.filterService")}
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="admin-filter-chip-control"
              >
                <option value="all">{t("admin.bookings.allServices")}</option>
                <option value="eye_exam">
                  {t("clinicBooking.services.eye_exam")}
                </option>
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

            <label
              className={`admin-filter-chip admin-filter-chip--date${
                dateFilter ? " is-active" : ""
              }`}
            >
              <span className="admin-filter-chip-label">
                {t("admin.bookings.filterDate")}
              </span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="admin-filter-chip-control admin-filter-chip-date"
              />
            </label>
          </div>

          {appointments.length === 0 ? (
            <div className="admin-bookings-empty">
              <p>{t("admin.bookings.noResults")}</p>
            </div>
          ) : (
            <div className="admin-bookings-list">
              {appointments.map((row) => (
                <article key={row.id} className="admin-booking-card">
                  <div className="admin-booking-card-main">
                    <div className="admin-booking-card-copy">
                      <h3 className="admin-booking-card-name">{row.fullName}</h3>
                      <p className="admin-booking-card-service">
                        {t(
                          `clinicBooking.services.${row.appointmentType || "eye_exam"}`
                        )}
                      </p>
                      <p className="admin-booking-card-when">
                        <span>{row.dateLabel}</span>
                        <span className="admin-booking-card-dot" aria-hidden />
                        <span>{row.appointmentTime}</span>
                      </p>
                    </div>
                    <select
                      value={row.status}
                      disabled={busy}
                      aria-label={t("admin.bookings.filterStatus")}
                      onChange={(e) =>
                        void updateAppointmentStatus(
                          row.id,
                          e.target.value as EyeExamAppointmentStatus
                        )
                      }
                      className={`admin-booking-status status status-${row.status}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {bookingStatusLabel(t, s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-booking-card-actions">
                    <button
                      type="button"
                      className="admin-booking-action"
                      onClick={() => openEdit(row)}
                    >
                      {t("admin.bookings.edit")}
                    </button>
                    {row.status !== "cancelled" ? (
                      <button
                        type="button"
                        className="admin-booking-action admin-booking-action--danger"
                        disabled={busy}
                        onClick={() =>
                          void updateAppointmentStatus(row.id, "cancelled")
                        }
                      >
                        {t("admin.bookings.cancel")}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <ManualBookingModal
        open={bookOpen}
        onClose={closeManualBooking}
        onCreated={() => {
          setMessage("Booking created");
          void refresh();
        }}
      />

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="admin-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
          >
            <h3 className="admin-section-title">Edit appointment</h3>
            <p className="admin-page-desc mt-2">{editing.fullName}</p>
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
