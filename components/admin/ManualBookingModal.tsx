"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
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
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

const GOLD = "#D4AF6A";
const PAGE_BG = "#0E1116";
const FIELD_BG = "#151A21";
const BORDER = "#2A2F36";
const MUTED = "#8A929C";
const VISIBLE_SLOTS = 8;

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

function showMoreLabel(locale: string) {
  if (locale === "ar") return "عرض المزيد";
  if (locale === "he") return "הצג עוד";
  return "Show more";
}

function showLessLabel(locale: string) {
  if (locale === "ar") return "عرض أقل";
  if (locale === "he") return "הצג פחות";
  return "Show less";
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
  const [showAllSlots, setShowAllSlots] = useState(false);

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
    setShowAllSlots(false);
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

  const visibleSlots = useMemo(() => {
    if (showAllSlots || availableSlots.length <= VISIBLE_SLOTS) {
      return availableSlots;
    }
    return availableSlots.slice(0, VISIBLE_SLOTS);
  }, [availableSlots, showAllSlots]);

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
    setShowAllSlots(false);
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

  const fieldStyle: CSSProperties = {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: FIELD_BG,
    color: "#F3F4F5",
    padding: "0.55rem 0.75rem",
    font: "inherit",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(11, 15, 20, 0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-[18px] sm:rounded-[18px]"
        style={{
          maxHeight: "92svh",
          background: PAGE_BG,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.bookings.manualTitle")}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 px-4 pb-3 pt-4"
          style={{ borderBottom: `1px solid ${BORDER}` }}
        >
          <div className="min-w-0">
            <h2
              className="m-0 text-[1.15rem] font-semibold tracking-[-0.02em]"
              style={{ color: "#F5F6F7", lineHeight: 1.35 }}
            >
              {t("admin.bookings.manualTitle")}
            </h2>
            <p
              className="mb-0 mt-0.5 text-[0.78rem]"
              style={{ color: MUTED, lineHeight: 1.4 }}
            >
              {t("admin.bookings.manualKicker")}
            </p>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{
              border: `1px solid ${BORDER}`,
              background: FIELD_BG,
              color: MUTED,
            }}
            onClick={onClose}
            aria-label={t("admin.bookings.close")}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        {error ? (
          <p
            className="mx-4 mt-3 mb-0 rounded-[12px] px-3 py-2 text-sm"
            style={{
              border: "1px solid rgba(224,122,122,0.35)",
              background: "rgba(224,122,122,0.12)",
              color: "var(--danger)",
            }}
          >
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(e) => void confirmBooking(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* Service */}
            <section>
              <p
                className="mb-2 mt-0 text-[0.78rem] font-medium"
                style={{ color: MUTED }}
              >
                {t("admin.bookings.service")}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((type) => {
                  const selected = service === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setService(type)}
                      className="rounded-[12px] px-2.5 py-2.5 text-start text-[0.8rem] font-semibold transition"
                      style={{
                        border: selected
                          ? "1px solid rgba(212,175,106,0.65)"
                          : `1px solid ${BORDER}`,
                        background: selected
                          ? "rgba(212,175,106,0.12)"
                          : FIELD_BG,
                        color: selected ? GOLD : "#F0F1F2",
                      }}
                    >
                      {serviceLabel(type)}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Date & Time */}
            <section>
              <p
                className="mb-2 mt-0 text-[0.78rem] font-medium"
                style={{ color: MUTED }}
              >
                {t("admin.bookings.date")}
              </p>
              <div
                className="rounded-[14px] p-3"
                style={{
                  background: FIELD_BG,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-[9px]"
                    style={{
                      border: "1px solid rgba(212,175,106,0.35)",
                      color: GOLD,
                      background: "rgba(212,175,106,0.06)",
                    }}
                    aria-label={t("clinicBooking.prevMonth")}
                    onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                  >
                    {rtl ? (
                      <ChevronRight size={15} strokeWidth={1.6} />
                    ) : (
                      <ChevronLeft size={15} strokeWidth={1.6} />
                    )}
                  </button>
                  <strong
                    className="text-[0.86rem] font-semibold"
                    style={{ color: "#F3F4F5" }}
                  >
                    {monthLabel}
                  </strong>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-[9px]"
                    style={{
                      border: "1px solid rgba(212,175,106,0.35)",
                      color: GOLD,
                      background: "rgba(212,175,106,0.06)",
                    }}
                    aria-label={t("clinicBooking.nextMonth")}
                    onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                  >
                    {rtl ? (
                      <ChevronLeft size={15} strokeWidth={1.6} />
                    ) : (
                      <ChevronRight size={15} strokeWidth={1.6} />
                    )}
                  </button>
                </div>

                <div className="mb-1 grid grid-cols-7 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const label = t(`eyeExam.weekdays.${d}`);
                    return (
                      <span
                        key={d}
                        className="truncate text-center text-[0.62rem] font-semibold"
                        style={{ color: "rgba(212,175,106,0.85)" }}
                        title={label}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                {loading ? (
                  <p
                    className="py-5 text-center text-sm"
                    style={{ color: MUTED }}
                  >
                    {t("admin.bookings.loadingDates")}
                  </p>
                ) : serviceDays.length === 0 ? (
                  <p
                    className="py-5 text-center text-sm"
                    style={{ color: MUTED }}
                  >
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
                            "aspect-square max-h-9 rounded-[9px] text-[0.8rem] font-semibold transition",
                            !inMonth && "opacity-20",
                            disabled && inMonth && "cursor-not-allowed opacity-30",
                          )}
                          style={
                            selected
                              ? {
                                  border: `1px solid ${GOLD}`,
                                  background: GOLD,
                                  color: "#1A140C",
                                }
                              : disabled
                                ? {
                                    border: "1px solid transparent",
                                    background: "transparent",
                                    color: MUTED,
                                  }
                                : {
                                    border: `1px solid ${BORDER}`,
                                    background: PAGE_BG,
                                    color: "#F0F1F2",
                                  }
                          }
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Times directly under calendar */}
                {date ? (
                  <div
                    className="mt-3 pt-3"
                    style={{ borderTop: `1px solid ${BORDER}` }}
                  >
                    <p
                      className="mb-2 mt-0 text-[0.78rem] font-medium"
                      style={{ color: MUTED }}
                    >
                      {t("admin.bookings.availableTime")}
                    </p>
                    {availableSlots.length === 0 ? (
                      <p
                        className="mb-0 rounded-[10px] px-2.5 py-3 text-center text-[0.8rem]"
                        style={{
                          color: MUTED,
                          border: `1px dashed ${BORDER}`,
                        }}
                      >
                        {t("admin.bookings.noAvailableTimes")}
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                          {visibleSlots.map((slot) => {
                            const selected = time === slot.time;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setTime(slot.time)}
                                className="rounded-[10px] px-1.5 py-2 text-center text-[0.8rem] font-bold tabular-nums transition"
                                style={
                                  selected
                                    ? {
                                        border: `1px solid ${GOLD}`,
                                        background: GOLD,
                                        color: "#1A140C",
                                      }
                                    : {
                                        border: `1px solid ${BORDER}`,
                                        background: PAGE_BG,
                                        color: "#F0F1F2",
                                      }
                                }
                              >
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                        {availableSlots.length > VISIBLE_SLOTS ? (
                          <button
                            type="button"
                            className="mt-2 w-full text-center text-[0.78rem] font-semibold"
                            style={{
                              color: GOLD,
                              background: "transparent",
                              border: "none",
                              padding: "0.35rem 0",
                            }}
                            onClick={() => setShowAllSlots((v) => !v)}
                          >
                            {showAllSlots
                              ? showLessLabel(locale)
                              : showMoreLabel(locale)}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            {/* Customer */}
            <section
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    className="mb-1.5 block text-[0.78rem] font-medium"
                    style={{ color: MUTED }}
                    htmlFor="mb-first"
                  >
                    {t("admin.bookings.firstName")}
                  </label>
                  <input
                    id="mb-first"
                    style={fieldStyle}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-[0.78rem] font-medium"
                    style={{ color: MUTED }}
                    htmlFor="mb-last"
                  >
                    {t("admin.bookings.lastName")}
                  </label>
                  <input
                    id="mb-last"
                    style={fieldStyle}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[0.78rem] font-medium"
                  style={{ color: MUTED }}
                  htmlFor="mb-phone"
                >
                  {t("admin.bookings.phone")}
                </label>
                <input
                  id="mb-phone"
                  style={fieldStyle}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05X-XXX-XXXX"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-[0.78rem] font-medium"
                  style={{ color: MUTED }}
                  htmlFor="mb-notes"
                >
                  {t("admin.bookings.notes")}
                </label>
                <textarea
                  id="mb-notes"
                  style={{
                    ...fieldStyle,
                    minHeight: 64,
                    resize: "vertical",
                  }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("admin.bookings.notesPlaceholder")}
                  rows={2}
                />
              </div>
            </section>
          </div>

          {/* Actions */}
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}`, background: PAGE_BG }}
          >
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-[12px] text-[0.9rem] font-semibold disabled:opacity-50"
              style={{
                background: "rgba(212,175,106,0.16)",
                border: "1px solid rgba(212,175,106,0.6)",
                color: GOLD,
                boxShadow: "0 0 16px rgba(212,175,106,0.12)",
              }}
            >
              {saving
                ? t("admin.bookings.confirming")
                : t("admin.bookings.confirmBooking")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-[12px] px-4 text-[0.84rem] font-semibold"
              style={{
                background: FIELD_BG,
                border: `1px solid ${BORDER}`,
                color: "#E8EAED",
              }}
            >
              {t("admin.bookings.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
