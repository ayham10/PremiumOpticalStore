"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, format } from "date-fns";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";

type AppointmentView = {
  id: string;
  service: string;
  staffId: string;
  staffName?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  manageToken: string;
};

function ManageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
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
  const [tokenInput, setTokenInput] = useState(token);

  const load = useCallback(
    async (tok: string) => {
      if (!tok) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const res = await fetch(`/api/appointments?token=${encodeURIComponent(tok)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("manage.notFound"));
        setAppointment(data.appointment as AppointmentView);
        setDate(data.appointment.date);
        setStartTime(data.appointment.startTime);
        setMode("view");
      } catch (err) {
        setAppointment(null);
        setError(err instanceof Error ? err.message : t("manage.notFound"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void load(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token, load]);

  useEffect(() => {
    if (mode !== "reschedule" || !appointment || !date) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSlotsLoading(true);
      void (async () => {
        try {
          const params = new URLSearchParams({
            staffId: appointment.staffId,
            date,
            service: appointment.service,
          });
          const res = await fetch(`/api/availability?${params}`);
          const data = (await res.json()) as { slots?: string[] };
          if (!cancelled) setSlots(data.slots || []);
        } catch {
          if (!cancelled) setSlots([]);
        } finally {
          if (!cancelled) setSlotsLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, appointment, date]);

  async function cancelAppointment() {
    if (!appointment || !token) return;
    if (!window.confirm(t("manage.confirmCancel"))) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("validation.generic"));
      setAppointment(data.appointment as AppointmentView);
      setMessage(t("manage.cancel"));
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("validation.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleAppointment(e: FormEvent) {
    e.preventDefault();
    if (!appointment || !token || !date || !startTime) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          date,
          startTime,
          status: "rescheduled",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("validation.generic"));
      setAppointment(data.appointment as AppointmentView);
      setMessage(t("manage.reschedule"));
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("validation.generic"));
    } finally {
      setBusy(false);
    }
  }

  const dateOptions = Array.from({ length: 45 }, (_, i) =>
    format(addDays(new Date(), i), "yyyy-MM-dd")
  );

  const cancelled = appointment?.status === "cancelled";

  return (
    <div className="pb-20 pt-28">
      <div className="wrap max-w-2xl">
        <Reveal>
          <span className="eyebrow">{t("manage.eyebrow")}</span>
          <h1 className="section-title">{t("manage.title")}</h1>
          <p className="section-lead">{t("manage.lead")}</p>
        </Reveal>

        {!token && (
          <form
            className="surface mt-10 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim()) {
                window.location.href = `/appointments/manage?token=${encodeURIComponent(
                  tokenInput.trim()
                )}`;
              }
            }}
          >
            <label>
              <span className="label">{t("manage.token")}</span>
              <input
                className="input"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={t("manage.token")}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary mt-4">
              {t("manage.find")}
            </button>
          </form>
        )}

        {loading && (
          <p className="mt-10 text-[var(--slate)]">{t("manage.loading")}</p>
        )}

        {error && (
          <p className="mt-6 text-sm font-medium text-[var(--danger)]">{error}</p>
        )}
        {message && (
          <p className="mt-6 text-sm font-medium text-[var(--success)]">{message}</p>
        )}

        {appointment && !loading && (
          <div className="surface mt-10 overflow-hidden">
            <div className="border-b border-[var(--line)] px-6 py-5 md:px-8">
              <span className={`status status-${appointment.status}`}>
                {appointment.status}
              </span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">
                {appointment.service}
              </h2>
            </div>

            <div className="space-y-3 px-6 py-6 text-[var(--ink-soft)] md:px-8">
              <p>
                <strong className="text-[var(--ink)]">{t("book.when")}:</strong>{" "}
                {formatDate(appointment.date)} at {appointment.startTime}
                {appointment.endTime ? `–${appointment.endTime}` : ""}
              </p>
              <p>
                <strong className="text-[var(--ink)]">{t("common.name")}:</strong>{" "}
                {appointment.customerName}
              </p>
              <p>
                <strong className="text-[var(--ink)]">{t("common.phone")}:</strong>{" "}
                {appointment.customerPhone} · {appointment.customerEmail}
              </p>
              {appointment.notes && (
                <p>
                  <strong className="text-[var(--ink)]">{t("common.notes")}:</strong>{" "}
                  {appointment.notes}
                </p>
              )}
            </div>

            {!cancelled && mode === "view" && (
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
                  onClick={cancelAppointment}
                  disabled={busy}
                >
                  {t("manage.cancel")}
                </button>
              </div>
            )}

            {!cancelled && mode === "reschedule" && (
              <form
                onSubmit={rescheduleAppointment}
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
                    onChange={(e) => {
                      setDate(e.target.value);
                      setStartTime("");
                    }}
                  >
                    {dateOptions.map((d) => (
                      <option key={d} value={d}>
                        {formatDate(d)}
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
            )}

            {cancelled && (
              <div className="border-t border-[var(--line)] px-6 py-5 md:px-8">
                <Link href="/book" className="btn btn-primary">
                  {t("book.bookAnother")}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ManageFallback() {
  const { t } = useLocale();
  return (
    <div className="wrap pb-20 pt-28 text-[var(--slate)]">{t("common.loading")}</div>
  );
}

export default function ManageAppointmentPage() {
  return (
    <Suspense fallback={<ManageFallback />}>
      <ManageContent />
    </Suspense>
  );
}
