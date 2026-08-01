"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Printer,
  Search,
  CalendarClock,
  StickyNote,
} from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import { apiFetch } from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/types";

const STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "rescheduled",
];

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["appointments", "items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export default function AdminAppointmentsPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [message, setMessage] = useState("");

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [notesTarget, setNotesTarget] = useState<Appointment | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<unknown>("/api/appointments");
      setItems(unwrapList<Appointment>(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.customerName.toLowerCase().includes(q) ||
        a.customerEmail.toLowerCase().includes(q) ||
        a.customerPhone.toLowerCase().includes(q) ||
        a.service.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  async function patchAppointment(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setMessage("");
    try {
      const updated = await apiFetch<Appointment | { appointment: Appointment }>(
        "/api/appointments",
        { method: "PATCH", body: JSON.stringify({ id, ...body }) }
      );
      const row =
        updated && typeof updated === "object" && "appointment" in updated
          ? updated.appointment
          : (updated as Appointment);
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, ...row } : a)));
      setMessage("Appointment updated");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onStatusChange(id: string, status: AppointmentStatus) {
    await patchAppointment(id, { status });
  }

  async function submitReschedule(e: FormEvent) {
    e.preventDefault();
    if (!rescheduleTarget) return;
    await patchAppointment(rescheduleTarget.id, {
      date: rescheduleDate,
      startTime: rescheduleTime,
      status: "rescheduled",
    });
    setRescheduleTarget(null);
  }

  async function submitNotes(e: FormEvent) {
    e.preventDefault();
    if (!notesTarget) return;
    await patchAppointment(notesTarget.id, { notes: notesValue });
    setNotesTarget(null);
  }

  async function sendSms(a: Appointment) {
    setBusyId(a.id);
    setMessage("");
    try {
      await apiFetch("/api/sms", {
        method: "POST",
        body: JSON.stringify({
          to: a.customerPhone,
          appointmentId: a.id,
          type: "custom",
          message: `LUMINA reminder: ${a.service} on ${a.date} at ${a.startTime}.`,
        }),
      });
      setMessage(`SMS queued for ${a.customerName}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "SMS failed");
    } finally {
      setBusyId(null);
    }
  }

  function printList() {
    window.print();
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1
            className="mt-1 text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Appointments
          </h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={printList}>
          <Printer size={16} /> Print
        </button>
      </header>

      <div className="admin-card flex flex-wrap gap-3 p-4 print:hidden">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]"
          />
          <input
            className="input pl-10"
            placeholder="Search name, email, phone, service…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="select max-w-[200px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)] print:hidden">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-[#fdeaea] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="admin-card overflow-hidden printable-appointments">
        <div className="hidden print:block px-5 py-4 border-b border-[var(--line)]">
          <h2 style={{ fontFamily: "Fraunces, serif" }}>{t("admin.sidebar.appointments")}</h2>
          <p className="text-sm text-[var(--slate)]">
            Printed {new Date().toLocaleString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Date / Time</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-[var(--slate)]">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-[var(--slate)]">
                    No appointments found
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium text-[var(--ink)]">{a.customerName}</div>
                      <div className="text-xs text-[var(--slate)]">{a.customerPhone}</div>
                      <div className="text-xs text-[var(--slate)]">{a.customerEmail}</div>
                    </td>
                    <td>{a.service}</td>
                    <td>
                      <div>{formatDate(a.date)}</div>
                      <div className="text-xs text-[var(--slate)]">
                        {a.startTime}–{a.endTime}
                      </div>
                    </td>
                    <td>
                      <select
                        className="select max-w-[150px] min-h-[40px] py-1 print:hidden"
                        value={a.status}
                        disabled={busyId === a.id}
                        onChange={(e) =>
                          void onStatusChange(a.id, e.target.value as AppointmentStatus)
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className={`status status-${a.status} hidden print:inline-flex`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate text-sm text-[var(--slate)]">
                      {a.notes || "—"}
                    </td>
                    <td className="print:hidden">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 !text-xs"
                          disabled={busyId === a.id}
                          onClick={() => {
                            setRescheduleTarget(a);
                            setRescheduleDate(a.date);
                            setRescheduleTime(a.startTime);
                          }}
                        >
                          <CalendarClock size={14} /> Reschedule
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 !text-xs"
                          disabled={busyId === a.id}
                          onClick={() => {
                            setNotesTarget(a);
                            setNotesValue(a.notes || "");
                          }}
                        >
                          <StickyNote size={14} /> Notes
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-9 !px-3 !text-xs"
                          disabled={busyId === a.id}
                          onClick={() => void sendSms(a)}
                        >
                          <MessageSquare size={14} /> SMS
                        </button>
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
        open={!!rescheduleTarget}
        title="Reschedule appointment"
        onClose={() => setRescheduleTarget(null)}
      >
        <form onSubmit={submitReschedule} className="space-y-4">
          <p className="text-sm text-[var(--slate)]">
            {rescheduleTarget?.customerName} · {rescheduleTarget?.service}
          </p>
          <div>
            <label className="label" htmlFor="r-date">
              Date
            </label>
            <input
              id="r-date"
              type="date"
              className="input"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="r-time">
              Start time
            </label>
            <input
              id="r-time"
              type="time"
              className="input"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRescheduleTarget(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent">
              Save
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={!!notesTarget}
        title="Edit notes"
        onClose={() => setNotesTarget(null)}
      >
        <form onSubmit={submitNotes} className="space-y-4">
          <textarea
            className="textarea"
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Internal notes…"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setNotesTarget(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-accent">
              Save notes
            </button>
          </div>
        </form>
      </AdminModal>

      </div>
  );
}
