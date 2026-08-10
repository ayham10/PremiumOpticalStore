"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Eye,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AvailabilityCalendarPanel from "@/components/admin/AvailabilityCalendarPanel";
import BookingsPanel from "@/components/admin/BookingsPanel";
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
  notes?: string;
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
  const [typeFilter, setTypeFilter] = useState("all");
  const dateParam = searchParams.get("date");
  const [dateFilter, setDateFilter] = useState(() =>
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : "",
  );

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setDateFilter(dateParam);
    }
  }, [dateParam]);

  useEffect(() => {
    if (tab !== "appointments") return;
    document.body.classList.add("admin-home-active");
    return () => document.body.classList.remove("admin-home-active");
  }, [tab]);

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
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (query.trim()) params.set("q", query.trim());
    const data = await apiFetch<{ appointments: AppointmentRow[] }>(
      `/api/admin/eye-exam/appointments?${params.toString()}`
    );
    setAppointments(data.appointments || []);
  }, [query, typeFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadAvailability(), loadAppointments()]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.bookings.loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [loadAppointments, loadAvailability, t]);

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
      setMessage(t("admin.availability.dateAdded"));
      window.dispatchEvent(new Event("oyon:availability-saved"));
      await loadAvailability();
      if (created.day?.id) setSelectedId(created.day.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.availability.addFailed")
      );
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
      setMessage(t("admin.availability.updated"));
      window.dispatchEvent(new Event("oyon:availability-saved"));
      await loadAvailability();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.bookings.updateError")
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteDay(id: string) {
    if (busy) return;
    if (!window.confirm(t("admin.availability.deleteConfirm"))) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/admin/eye-exam/availability?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setMessage(t("admin.availability.dateRemoved"));
      window.dispatchEvent(new Event("oyon:availability-saved"));
      await loadAvailability();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("admin.availability.deleteFailed")
      );
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
      setMessage(t("admin.bookings.saved"));
      setEditing(null);
      await loadAppointments();
      await loadAvailability();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.bookings.updateError")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={tab === "appointments" ? "admin-bookings-page" : "space-y-6"}>
      {tab === "availability" ? (
        <AdminPageHeader
          title={t("admin.availability.title")}
          description={t("admin.availability.description")}
          actions={
            <>
              <Link
                href="/"
                target="_blank"
                className="btn btn-ghost inline-flex items-center gap-2"
              >
                <Eye size={16} />
                {t("admin.availability.previewSite")}
              </Link>
              <button
                type="button"
                className="btn btn-accent inline-flex items-center gap-2"
                onClick={() => void refresh()}
                disabled={loading || busy}
              >
                <CalendarCheck size={16} />
                {t("admin.availability.saveChanges")}
              </button>
            </>
          }
        />
      ) : null}

      {message ? (
        <p className="mb-4 rounded-xl border border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.12)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {tab === "availability" && loading ? (
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
        <BookingsPanel
          appointments={appointments}
          loading={loading}
          busy={busy}
          query={query}
          onQueryChange={setQuery}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          onRefresh={() => void refresh()}
          onAdd={openManualBooking}
          onOpenRow={(row) => {
            const full = appointments.find((a) => a.id === row.id);
            if (full) openEdit(full);
          }}
          serviceLabel={(type) =>
            t(`clinicBooking.services.${type || "eye_exam"}`)
          }
        />
      )}

      <ManualBookingModal
        open={bookOpen}
        onClose={closeManualBooking}
        onCreated={() => {
          setMessage(t("admin.bookings.created"));
          void refresh();
        }}
      />

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form
            onSubmit={saveEdit}
            className="admin-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5"
          >
            <h3 className="admin-section-title">
              {t("admin.bookings.editTitle")}
            </h3>
            <p className="admin-page-desc mt-2">{editing.fullName}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--slate)]">
                {t("admin.bookings.firstName")}
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
                {t("admin.bookings.lastName")}
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
                {t("admin.bookings.email")}
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
                {t("admin.bookings.phone")}
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
                {t("admin.bookings.service")}
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
                {t("admin.bookings.date")}
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
                {t("admin.bookings.time")}
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
                  <option value="">{t("admin.bookings.selectTime")}</option>
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
                {t("admin.bookings.status")}
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
                      {bookingStatusLabel(t, s)}
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
                {t("admin.bookings.close")}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy
                  ? t("admin.bookings.saving")
                  : t("admin.bookings.save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AdminEyeExamFallback() {
  const { t } = useLocale();
  return <p className="text-[var(--slate)]">{t("common.loading")}</p>;
}

export default function AdminEyeExamPage() {
  return (
    <Suspense fallback={<AdminEyeExamFallback />}>
      <AdminEyeExamPageInner />
    </Suspense>
  );
}
