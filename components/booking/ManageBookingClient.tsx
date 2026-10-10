"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Eye,
  Glasses,
  Trash2,
  User,
} from "lucide-react";
import { ar, enUS, he } from "date-fns/locale";
import { format } from "date-fns";
import CenteredSuccessNotice from "@/components/feedback/CenteredSuccessNotice";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  EXPIRED_MANAGE_LINK_MESSAGE,
  EXPIRED_MANAGE_LINK_MESSAGE_EN,
  EXPIRED_MANAGE_LINK_MESSAGE_HE,
} from "@/lib/booking-manage-constants";
import { buildMonthGrid, formatClinicDateDisplay } from "@/lib/clinic-booking";

type AppointmentView = {
  customerName: string;
  service: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  appointmentType: string;
  dateLabel?: string;
};

type ConfirmKind = "cancel" | "reschedule" | null;

function manageHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Booking-Token": token,
  };
}

function jerusalemToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function localizeManageError(
  translate: (path: string) => string,
  message: string,
): string {
  const raw = message.trim();
  if (
    !raw ||
    raw === EXPIRED_MANAGE_LINK_MESSAGE ||
    raw === EXPIRED_MANAGE_LINK_MESSAGE_HE ||
    raw === EXPIRED_MANAGE_LINK_MESSAGE_EN
  ) {
    return translate("manage.expired");
  }
  const table: Array<[RegExp, string]> = [
    [/appointment not found/i, "manage.notFound"],
    [/too many requests/i, "manage.rateLimited"],
    [/can no longer be changed/i, "manage.cannotChange"],
    [/select a valid date/i, "manage.invalidDate"],
    [/select a valid time/i, "manage.invalidTime"],
    [/date is not available/i, "manage.dateUnavailable"],
    [/time is not available/i, "manage.timeUnavailable"],
    [/no longer available/i, "manage.slotUnavailable"],
    [/refusing to change/i, "manage.cannotChange"],
  ];
  for (const [pattern, key] of table) {
    if (pattern.test(raw)) return translate(key);
  }
  return raw;
}

export default function ManageBookingClient({ token }: { token: string }) {
  const { t, locale, rtl } = useLocale();
  const [appointment, setAppointment] = useState<AppointmentView | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const today = useMemo(() => jerusalemToday(), []);
  const initialMonth = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  }, [today]);
  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.month);

  const dateLocale = locale === "ar" ? ar : locale === "he" ? he : enUS;

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError(t("manage.expired"));
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
        throw new Error(
          localizeManageError(t, data.error || EXPIRED_MANAGE_LINK_MESSAGE),
        );
      }
      if (!data.appointment) throw new Error(t("manage.notFound"));
      setAppointment(data.appointment);
      setDate(data.appointment.appointmentDate);
      setStartTime(data.appointment.appointmentTime);
      const [y, m] = data.appointment.appointmentDate.split("-").map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    } catch (err) {
      setAppointment(null);
      setError(
        localizeManageError(
          t,
          err instanceof Error ? err.message : EXPIRED_MANAGE_LINK_MESSAGE,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!appointment?.appointmentType || appointment.status !== "confirmed") {
      return;
    }
    let cancelled = false;
    setLoadingDates(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          type: appointment.appointmentType,
        });
        const res = await fetch(`/api/eye-exam/available-dates?${params}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { dates?: Array<{ date: string }> };
        if (cancelled) return;
        const dates = (data.dates || []).map((item) => item.date);
        if (
          appointment.appointmentDate &&
          !dates.includes(appointment.appointmentDate)
        ) {
          dates.push(appointment.appointmentDate);
        }
        setAvailableDates(dates);
      } catch {
        if (!cancelled) setAvailableDates([]);
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointment]);

  useEffect(() => {
    if (!appointment || appointment.status !== "confirmed" || !date) return;
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
  }, [appointment, date]);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const timesForUi = useMemo(() => {
    const unique = new Set(slots);
    if (
      appointment &&
      date === appointment.appointmentDate &&
      appointment.appointmentTime
    ) {
      unique.add(appointment.appointmentTime);
    }
    return Array.from(unique).sort();
  }, [slots, appointment, date]);

  const canMutate = appointment?.status === "confirmed";
  const cancelled = appointment?.status === "cancelled";
  const selectionChanged = Boolean(
    appointment &&
      date &&
      startTime &&
      (date !== appointment.appointmentDate ||
        startTime !== appointment.appointmentTime),
  );

  const monthLabel = format(new Date(viewYear, viewMonth, 1), "LLLL yyyy", {
    locale: dateLocale,
  });
  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      confirmed: t("manage.statusConfirmed"),
      cancelled: t("manage.statusCancelled"),
      completed: t("manage.statusCompleted"),
      "no-show": t("manage.statusNoShow"),
      no_show: t("manage.statusNoShow"),
      pending: t("manage.statusPending"),
    };
    return map[status] || t("manage.statusPending");
  }

  function localizeService(raw: string): string {
    const mapped = t(`clinicBooking.services.${raw}`);
    if (mapped && mapped !== `clinicBooking.services.${raw}`) return mapped;
    return raw;
  }

  function weekdayLabel(day: number): string {
    return t(`manage.weekday${day}`);
  }

  function badgeModifier(status: string): string {
    if (status === "cancelled") return " is-cancelled";
    if (status === "confirmed") return " is-confirmed";
    return " is-muted";
  }

  async function cancelAppointment() {
    if (!appointment || !token) return;
    setBusy(true);
    setError("");
    setMessage("");
    setConfirmKind(null);
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
      if (!res.ok) {
        throw new Error(
          localizeManageError(t, data.error || t("validation.generic")),
        );
      }
      if (!data.appointment) {
        throw new Error(t("validation.generic"));
      }
      setAppointment(data.appointment);
      setMessage(t("manage.successCancelled"));
    } catch (err) {
      setError(
        localizeManageError(
          t,
          err instanceof Error ? err.message : t("validation.generic"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleAppointment() {
    if (!appointment || !token || !date || !startTime || !selectionChanged) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setConfirmKind(null);
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
      if (!res.ok) {
        throw new Error(
          localizeManageError(t, data.error || t("validation.generic")),
        );
      }
      if (!data.appointment) {
        throw new Error(t("validation.generic"));
      }
      setAppointment(data.appointment);
      setDate(data.appointment.appointmentDate);
      setStartTime(data.appointment.appointmentTime);
      setMessage(t("manage.successRescheduled"));
    } catch (err) {
      setError(
        localizeManageError(
          t,
          err instanceof Error ? err.message : t("validation.generic"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const detailsRows: Array<{
    icon: typeof User;
    label: string;
    value: string;
    ltr?: boolean;
  }> = appointment
    ? [
        {
          icon: User,
          label: t("manage.fullName"),
          value: appointment.customerName,
        },
        {
          icon: Eye,
          label: t("manage.service"),
          value: localizeService(appointment.service),
        },
        {
          icon: CalendarDays,
          label: t("manage.date"),
          value:
            appointment.dateLabel ||
            formatClinicDateDisplay(appointment.appointmentDate),
          ltr: true,
        },
        {
          icon: Clock3,
          label: t("manage.time"),
          value: appointment.appointmentTime,
          ltr: true,
        },
        {
          icon: CircleDot,
          label: t("manage.status"),
          value: statusLabel(appointment.status),
        },
      ]
    : [];

  return (
    <div className="oyon-manage-page">
      <div className="oyon-manage-glow" aria-hidden />
      <div className="oyon-manage-side oyon-manage-side-start" aria-hidden />
      <div className="oyon-manage-side oyon-manage-side-end" aria-hidden />

      <div className="oyon-manage-wrap">
        <header className="oyon-manage-hero">
          <CalendarDays size={22} strokeWidth={1.5} aria-hidden />
          <h1>{t("manage.title")}</h1>
          <p>{t("manage.lead")}</p>
          <div className="oyon-manage-divider" aria-hidden>
            <span />
            <Glasses size={16} strokeWidth={1.6} />
            <span />
          </div>
        </header>

        {loading ? (
          <p className="oyon-manage-banner" role="status">
            {t("manage.loading")}
          </p>
        ) : null}

        {error ? (
          <p className="oyon-manage-banner is-error" role="alert">
            {error}
          </p>
        ) : null}

        {appointment && !loading ? (
          <div className="oyon-manage-grid">
            <section className="oyon-manage-card">
              <div className="oyon-manage-card-head">
                <h2>
                  <CalendarDays size={16} strokeWidth={1.6} aria-hidden />
                  {t("manage.detailsTitle")}
                </h2>
                <span
                  className={`oyon-manage-badge${badgeModifier(appointment.status)}`}
                >
                  {statusLabel(appointment.status)}
                </span>
              </div>

              <div className="oyon-manage-table">
                {detailsRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div className="oyon-manage-row" key={row.label}>
                      <span className="oyon-manage-row-label">
                        <Icon size={15} strokeWidth={1.6} aria-hidden />
                        {row.label}
                      </span>
                      <strong
                        className="oyon-manage-row-value"
                        dir={row.ltr ? "ltr" : undefined}
                      >
                        {row.value}
                      </strong>
                    </div>
                  );
                })}
              </div>

              {canMutate ? (
                <div className="oyon-manage-card-foot">
                  <button
                    type="button"
                    className="oyon-manage-cancel"
                    onClick={() => setConfirmKind("cancel")}
                    disabled={busy}
                  >
                    <Trash2 size={16} strokeWidth={1.7} aria-hidden />
                    {t("manage.cancel")}
                  </button>
                  <p>{t("manage.cancelHint")}</p>
                </div>
              ) : cancelled ? (
                <div className="oyon-manage-card-foot">
                  <p className="oyon-manage-cancelled-copy">
                    {t("manage.cancelledNotice")}
                  </p>
                  <Link href="/book" className="oyon-manage-confirm">
                    {t("book.bookAnother")}
                  </Link>
                </div>
              ) : null}
            </section>

            <section className="oyon-manage-card oyon-manage-card-wide">
              <div className="oyon-manage-card-head">
                <div>
                  <h2>
                    <CalendarDays size={16} strokeWidth={1.6} aria-hidden />
                    {t("manage.rescheduleTitle")}
                  </h2>
                  <p className="oyon-manage-card-lead">
                    {t("manage.rescheduleLead")}
                  </p>
                </div>
              </div>

              {canMutate ? (
                <>
                  <div className="oyon-manage-reschedule">
                    <div className="oyon-manage-cal">
                      <div className="oyon-manage-cal-nav">
                        <button
                          type="button"
                          aria-label={t("clinicBooking.prevMonth")}
                          onClick={() => shiftMonth(-1)}
                        >
                          {rtl ? (
                            <ChevronRight size={16} strokeWidth={1.7} />
                          ) : (
                            <ChevronLeft size={16} strokeWidth={1.7} />
                          )}
                        </button>
                        <strong>{monthLabel}</strong>
                        <button
                          type="button"
                          aria-label={t("clinicBooking.nextMonth")}
                          onClick={() => shiftMonth(1)}
                        >
                          {rtl ? (
                            <ChevronLeft size={16} strokeWidth={1.7} />
                          ) : (
                            <ChevronRight size={16} strokeWidth={1.7} />
                          )}
                        </button>
                      </div>
                      <div className="oyon-manage-cal-week">
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                          <span key={day}>{weekdayLabel(day)}</span>
                        ))}
                      </div>
                      <div
                        className={`oyon-manage-cal-grid${loadingDates ? " is-loading" : ""}`}
                      >
                        {grid.map((cell, idx) => {
                          if (!cell.iso || cell.day == null) {
                            return (
                              <span
                                key={`empty-${idx}`}
                                className="oyon-manage-cal-empty"
                              />
                            );
                          }
                          const selectable =
                            !loadingDates &&
                            (availableSet.has(cell.iso) ||
                              cell.iso === appointment.appointmentDate);
                          const selected = date === cell.iso;
                          return (
                            <button
                              key={cell.iso}
                              type="button"
                              disabled={!selectable}
                              className={`oyon-manage-cal-day${selected ? " is-selected" : ""}${
                                selectable ? " is-available" : " is-disabled"
                              }`}
                              onClick={() => {
                                setDate(cell.iso!);
                                setStartTime(
                                  cell.iso === appointment.appointmentDate
                                    ? appointment.appointmentTime
                                    : "",
                                );
                              }}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="oyon-manage-times">
                      <p className="oyon-manage-times-title">
                        <Clock3 size={15} strokeWidth={1.6} aria-hidden />
                        {t("manage.availableTimes")}
                        {date ? (
                          <span>
                            {formatClinicDateDisplay(date)}
                          </span>
                        ) : null}
                      </p>
                      {slotsLoading ? (
                        <p className="oyon-manage-muted">{t("manage.loading")}</p>
                      ) : timesForUi.length === 0 ? (
                        <p className="oyon-manage-muted">
                          {t("clinicBooking.emptyTimes")}
                        </p>
                      ) : (
                        <div className="oyon-manage-time-grid">
                          {timesForUi.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className={`oyon-manage-time${startTime === slot ? " is-selected" : ""}`}
                              dir="ltr"
                              onClick={() => setStartTime(slot)}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="oyon-manage-card-foot">
                    <button
                      type="button"
                      className="oyon-manage-confirm"
                      disabled={busy || !selectionChanged}
                      onClick={() => setConfirmKind("reschedule")}
                    >
                      {t("manage.confirmChange")}
                    </button>
                    <p>{t("manage.rescheduleHint")}</p>
                  </div>
                </>
              ) : (
                <p className="oyon-manage-muted oyon-manage-locked">
                  {cancelled
                    ? t("manage.cancelledNotice")
                    : t("manage.cannotChange")}
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {message ? (
        <CenteredSuccessNotice
          message={message}
          onClose={() => setMessage("")}
        />
      ) : null}

      {confirmKind ? (
        <div
          className="oyon-manage-modal-overlay"
          role="presentation"
          onClick={() => !busy && setConfirmKind(null)}
        >
          <div
            className="oyon-manage-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {confirmKind === "cancel"
                ? t("manage.confirmCancel")
                : t("manage.confirmReschedule")}
            </h3>
            <p>
              {confirmKind === "cancel"
                ? t("manage.cancelHint")
                : t("manage.confirmRescheduleDetail", {
                    date: formatClinicDateDisplay(date),
                    time: startTime,
                  })}
            </p>
            <div className="oyon-manage-modal-actions">
              <button
                type="button"
                className={
                  confirmKind === "cancel"
                    ? "oyon-manage-cancel"
                    : "oyon-manage-confirm"
                }
                disabled={busy}
                onClick={() =>
                  void (confirmKind === "cancel"
                    ? cancelAppointment()
                    : rescheduleAppointment())
                }
              >
                {confirmKind === "cancel"
                  ? t("manage.cancel")
                  : t("manage.confirmChange")}
              </button>
              <button
                type="button"
                className="oyon-manage-modal-back"
                disabled={busy}
                onClick={() => setConfirmKind(null)}
              >
                {t("book.back")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
