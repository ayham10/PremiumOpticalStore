"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format } from "date-fns";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { EXPIRED_MANAGE_LINK_MESSAGE } from "@/lib/booking-manage-constants";
import { formatDate } from "@/lib/format";

type AppointmentView = {
  customerName: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  appointmentType: string;
  dateLabel?: string;
};

function manageHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Booking-Token": token,
  };
}

export default function ManageBookingClient({ token }: { token: string }) {
  const { t } = useLocale();
  const [appointment, setAppointment] = useState<AppointmentView | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError(EXPIRED_MANAGE_LINK_MESSAGE);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/booking/manage", {
        headers: manageHeaders(token),
        cache: "no-store",
      });
      const data = (await res.json()) as {
        appointment?: AppointmentView;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || EXPIRED_MANAGE_LINK_MESSAGE);
      }
      if (!data.appointment) throw new Error(t("manage.notFound"));
      setAppointment(data.appointment);
      setDate(data.appointment.appointmentDate);
      setStartTime(data.appointment.appointmentTime);
      setMode("view");
    } catch (err) {
      setAppointment(null);
      setError(err instanceof Error ? err.message : EXPIRED_MANAGE_LINK_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          date,
          type: appointment.appointmentType,
        });
        const res = await fetch(`/api/eye-exam/available-times?${params}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { times?: string[] };
        if (!cancelled) setSlots(data.times || []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, appointment, date]);

  async function cancelAppointment() {
    if (!appointment || !token) return;
    if (!window.confirm(t("manage.confirmCancel"))) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/booking/manage", {
        method: "PATCH",
        headers: manageHeaders(token),
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = (await res.json()) as {
        appointment?: AppointmentView;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || t("validation.generic"));
      if (data.appointment) setAppointment(data.appointment);
      setMessage(t("manage.cancel"));
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("validation.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleAppointment(event: FormEvent) {
    event.preventDefault();
    if (!appointment || !token || !date || !startTime) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/booking/manage", {
        method: "PATCH",
        headers: manageHeaders(token),
        body: JSON.stringify({
          action: "reschedule",
          appointmentDate: date,
          appointmentTime: startTime,
        }),
      });
      const data = (await res.json()) as {
        appointment?: AppointmentView;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || t("validation.generic"));
      if (data.appointment) {
        setAppointment(data.appointment);
        setDate(data.appointment.appointmentDate);
        setStartTime(data.appointment.appointmentTime);
      }
      setMessage(t("manage.reschedule"));
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("validation.generic"));
    } finally {
      setBusy(false);
    }
  }

  const dateOptions = Array.from({ length: 45 }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd"),
  );
  const cancelled = appointment?.status === "cancelled";
  const canMutate = appointment?.status === "confirmed";

  return (
    <div className="pb-20 pt-28">
      <div className="wrap max-w-2xl">
        <Reveal>
          <span className="eyebrow">{t("manage.eyebrow")}</span>
          <h1 className="section-title">{t("manage.title")}</h1>
          <p className="section-lead">{t("manage.lead")}</p>
        </Reveal>

        {loading ? (
          <p className="mt-10 text-[var(--slate)]">{t("manage.loading")}</p>
        ) : null}

        {error ? (
          <p className="mt-8 text-sm font-medium leading-7 text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-6 text-sm font-medium text-[var(--success)]">{message}</p>
        ) : null}

        {appointment && !loading ? (
          <div className="surface mt-10 overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-5 md:px-8">
              <span className={`status status-${appointment.status}`}>
                {appointment.status}
              </span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--accent)]">
                {appointment.service}
              </h2>
            </div>
            <div className="space-y-3 px-6 py-6 text-[var(--ink-soft)] md:px-8">
              <p>
                <strong className="text-[var(--ink)]">{t("common.name")}:</strong>{" "}
                {appointment.customerName}
              </p>
              <p>
                <strong className="text-[var(--ink)]">{t("manage.service")}:</strong>{" "}
                {appointment.service}
              </p>
              <p>
                <strong className="text-[var(--ink)]">{t("book.when")}:</strong>{" "}
                {appointment.dateLabel || formatDate(appointment.appointmentDate)}{" "}
                {appointment.appointmentTime}
              </p>
              <p>
                <strong className="text-[var(--ink)]">{t("manage.status")}:</strong>{" "}
                {appointment.status}
              </p>
            </div>

            {canMutate && mode === "view" ? (
              <div className="flex flex-wrap gap-3 border-t border-[var(--line)] px-6 py-5 md:px-8">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMode("reschedule")}
                  disabled={busy}
                >
                  {t("manage.reschedule")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost !border-[var(--danger)] !text-[var(--danger)]"
                  onClick={() => void cancelAppointment()}
                  disabled={busy}
                >
                  {t("manage.cancel")}
                </button>
              </div>
            ) : null}

            {canMutate && mode === "reschedule" ? (
              <form
                onSubmit={(event) => void rescheduleAppointment(event)}
                className="border-t border-[var(--line)] px-6 py-6 md:px-8"
              >
                <h3 className="font-[family-name:var(--font-display)] text-2xl">
                  {t("book.chooseTime")}
                </h3>
                <label className="mt-5 block">
                  <span className="label">{t("common.date")}</span>
                  <select
                    className="select"
                    value={date}
                    onChange={(event) => {
                      setDate(event.target.value);
                      setStartTime("");
                    }}
                  >
                    {dateOptions.map((value) => (
                      <option key={value} value={value}>
                        {formatDate(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-5">
                  <span className="label">{t("book.chooseTime")}</span>
                  {slotsLoading ? (
                    <p className="text-sm text-[var(--slate)]">{t("common.loading")}</p>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-[var(--slate)]">{t("book.noSlots")}</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setStartTime(slot)}
                          className={`rounded-full border py-2.5 text-sm font-semibold ${
                            startTime === slot
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--line-strong)]"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setMode("view")}
                  >
                    {t("book.back")}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !startTime}
                  >
                    {busy ? t("common.loading") : t("manage.save")}
                  </button>
                </div>
              </form>
            ) : null}

            {cancelled ? (
              <div className="border-t border-[var(--line)] px-6 py-5 md:px-8">
                <Link href="/book" className="btn btn-primary">
                  {t("book.bookAnother")}
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
