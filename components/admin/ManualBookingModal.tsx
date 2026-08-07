"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ar, enUS, he } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/admin-api";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ClinicAppointmentType } from "@/lib/types";
import { cn } from "@/lib/format";

const SERVICES: ClinicAppointmentType[] = [
  "eye_exam",
  "contact_lens_fitting",
  "frame_consultation",
  "sunglasses_consultation",
];

function daySupports(
  day: { services?: ClinicAppointmentType[] },
  type: ClinicAppointmentType,
) {
  const services = day.services || [];
  if (!services.length) return true;
  return services.includes(type);
}

/** Backend still expects email; UI no longer collects it. */
function syntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "") || "guest";
  return `booking.${digits}@oyon.guest`;
}

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

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

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function ManualBookingModal({ open, onClose, onCreated }: Props) {
  const { t, locale, rtl } = useLocale();
  const dateLocale = locale === "ar" ? ar : locale === "he" ? he : enUS;
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [service, setService] = useState<ClinicAppointmentType>("eye_exam");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const reset = useCallback(() => {
    setService("eye_exam");
    setDate("");
    setTime("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setNotes("");
    setError("");
    setMonthCursor(new Date());
  }, []);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ days: DayRow[] }>(
        "/api/admin/eye-exam/availability",
      );
      setDays(data.days || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.bookings.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    reset();
    void loadSchedule();
  }, [open, reset, loadSchedule]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const serviceDays = useMemo(() => {
    return days.filter((d) => d.isOpen && daySupports(d, service));
  }, [days, service]);

  const availableSet = useMemo(
    () => new Set(serviceDays.map((d) => d.date)),
    [serviceDays],
  );

  const selectedDay = useMemo(
    () => serviceDays.find((d) => d.date === date) || null,
    [serviceDays, date],
  );

  const availableSlots = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.slots.filter((s) => s.isEnabled && !s.isBooked);
  }, [selectedDay]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const monthLabel = useMemo(
    () => format(monthCursor, "MMMM yyyy", { locale: dateLocale }),
    [monthCursor, dateLocale],
  );

  const todayIso = useMemo(() => ymd(new Date()), []);

  useEffect(() => {
    if (!date) return;
    if (!serviceDays.some((d) => d.date === date)) {
      setDate("");
      setTime("");
    }
  }, [service, serviceDays, date]);

  useEffect(() => {
    setTime("");
  }, [date]);

  useEffect(() => {
    if (!date) return;
    const [y, m] = date.split("-").map(Number);
    if (!y || !m) return;
    setMonthCursor(new Date(y, m - 1, 1));
  }, [date]);

  const serviceLabel = (type: ClinicAppointmentType) =>
    t(`clinicBooking.services.${type}`);

  const canSubmit =
    Boolean(date && time && firstName.trim() && lastName.trim() && phone.trim()) &&
    !saving;

  async function confirmBooking(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/eye-exam/book", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: syntheticEmail(phone),
          appointmentDate: date,
          appointmentTime: time,
          appointmentType: service,
          language: locale === "ar" || locale === "he" ? locale : "en",
          notes: notes.trim() || undefined,
          source: "admin",
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("admin.bookings.updateError");
      const conflict =
        /conflict|unavailable|already|taken|booked/i.test(message) ||
        (err instanceof ApiError && err.status === 409);
      setError(conflict ? t("admin.bookings.conflictError") : message);
      await loadSchedule();
      if (conflict) setTime("");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(11, 15, 20, 0.78)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-card flex max-h-[94svh] w-full max-w-lg flex-col overflow-hidden rounded-b-none sm:rounded-[18px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.bookings.manualTitle")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <p className="admin-kicker">{t("admin.bookings.manualKicker")}</p>
            <h2 className="admin-section-title mt-1">
              {t("admin.bookings.manualTitle")}
            </h2>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]"
            onClick={onClose}
            aria-label={t("admin.bookings.close")}
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(e) => void confirmBooking(e)}
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pe-1 pb-2">
            <div>
              <p className="admin-card-label mb-2">
                {t("admin.bookings.service")}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SERVICES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setService(type)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-start text-sm font-semibold transition",
                      service === type
                        ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
                        : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--accent)]",
                    )}
                  >
                    {serviceLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="admin-card-label mb-2">{t("admin.bookings.date")}</p>
              <div className="rounded-xl border border-[var(--line)] bg-[rgba(12,16,22,0.55)] p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(212,175,106,0.3)] text-[#e6c58a] transition hover:border-[rgba(212,175,106,0.55)] hover:bg-[rgba(212,175,106,0.1)]"
                    aria-label={t("clinicBooking.prevMonth")}
                    onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                  >
                    {rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                  </button>
                  <strong className="text-sm font-bold text-[var(--ink)]">
                    {monthLabel}
                  </strong>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(212,175,106,0.3)] text-[#e6c58a] transition hover:border-[rgba(212,175,106,0.55)] hover:bg-[rgba(212,175,106,0.1)]"
                    aria-label={t("clinicBooking.nextMonth")}
                    onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                  >
                    {rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>

                <div className="mb-1.5 grid grid-cols-7 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const label = t(`eyeExam.weekdays.${d}`);
                    return (
                      <span
                        key={d}
                        className="truncate text-center text-[0.62rem] font-semibold text-[rgba(212,175,106,0.8)]"
                        title={label}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                {loading ? (
                  <p className="admin-muted py-6 text-center text-sm">
                    {t("admin.bookings.loadingDates")}
                  </p>
                ) : serviceDays.length === 0 ? (
                  <p className="admin-muted py-6 text-center text-sm">
                    {t("admin.bookings.noDates")}
                  </p>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day) => {
                      const iso = ymd(day);
                      const inMonth = isSameMonth(day, monthCursor);
                      const available = availableSet.has(iso);
                      const disabled =
                        !inMonth || iso < todayIso || !available;
                      const selected = date === iso;
                      return (
                        <button
                          key={iso + String(inMonth)}
                          type="button"
                          disabled={disabled}
                          onClick={() => setDate(iso)}
                          className={cn(
                            "aspect-square max-h-10 rounded-[10px] text-sm font-semibold transition",
                            !inMonth && "opacity-25",
                            disabled && inMonth && "cursor-not-allowed opacity-30",
                            !disabled &&
                              !selected &&
                              "border border-[var(--line)] bg-[rgba(21,25,31,0.9)] text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[rgba(212,175,106,0.12)]",
                            selected &&
                              "border border-[#d4af6a] bg-[#d4af6a] text-[#1a140c] shadow-[0_0_0_1px_rgba(212,175,106,0.35)]",
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="admin-card-label mb-2">
                {t("admin.bookings.availableTime")}
              </p>
              {!date ? (
                <p className="admin-muted rounded-xl border border-dashed border-[var(--line)] px-3 py-6 text-center text-sm">
                  {t("admin.bookings.selectDateFirst")}
                </p>
              ) : availableSlots.length === 0 ? (
                <p className="admin-muted rounded-xl border border-dashed border-[var(--line)] px-3 py-6 text-center text-sm">
                  {t("admin.bookings.noAvailableTimes")}
                </p>
              ) : (
                <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pe-1 sm:grid-cols-4">
                  {availableSlots.map((slot) => {
                    const selected = time === slot.time;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setTime(slot.time)}
                        className={cn(
                          "rounded-[10px] border px-2 py-2.5 text-center text-sm font-bold tabular-nums transition",
                          selected
                            ? "border-[#D4AF6A] bg-[#D4AF6A] text-[#1a140c] shadow-[0_0_0_1px_rgba(212,175,106,0.28)]"
                            : "border-[var(--line)] bg-[rgba(21,25,31,0.9)] text-[var(--ink)] hover:border-[var(--accent)] hover:bg-[rgba(212,175,106,0.12)]",
                        )}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="mb-first">
                  {t("admin.bookings.firstName")}
                </label>
                <input
                  id="mb-first"
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="label" htmlFor="mb-last">
                  {t("admin.bookings.lastName")}
                </label>
                <input
                  id="mb-last"
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="mb-phone">
                  {t("admin.bookings.phone")}
                </label>
                <input
                  id="mb-phone"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXX-XXXX"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="mb-notes">
                  {t("admin.bookings.notes")}
                </label>
                <textarea
                  id="mb-notes"
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("admin.bookings.notesPlaceholder")}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("admin.bookings.cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={!canSubmit}
            >
              <Check size={16} />
              {saving
                ? t("admin.bookings.confirming")
                : t("admin.bookings.confirmBooking")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
