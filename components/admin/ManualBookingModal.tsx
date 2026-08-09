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
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ar, enUS, he } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Eye,
  Glasses,
  Sun,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
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

const SERVICE_ICONS: Record<ClinicAppointmentType, LucideIcon> = {
  eye_exam: Eye,
  contact_lens_fitting: CircleDot,
  frame_consultation: Glasses,
  sunglasses_consultation: Sun,
};

const GOLD = "#D4AF6A";
const PAGE_BG = "#0E1116";
const FIELD_BG = "#151A21";
const BORDER = "#2A2F36";
const MUTED = "#8A929C";

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

function sectionAppointmentDetails(locale: string) {
  if (locale === "ar") return "تفاصيل الموعد";
  if (locale === "he") return "פרטי התור";
  return "Appointment details";
}

function sectionChooseDate(locale: string) {
  if (locale === "ar") return "اختر التاريخ";
  if (locale === "he") return "בחירת תאריך";
  return "Choose date";
}

function sectionChooseTime(locale: string) {
  if (locale === "ar") return "اختر الوقت";
  if (locale === "he") return "בחירת שעה";
  return "Choose time";
}

function sectionCustomer(locale: string) {
  if (locale === "ar") return "بيانات العميل";
  if (locale === "he") return "פרטי לקוח";
  return "Customer details";
}

function backLabel(locale: string) {
  if (locale === "ar") return "رجوع";
  if (locale === "he") return "חזרה";
  return "Back";
}

function changeTimeLabel(locale: string) {
  if (locale === "ar") return "تغيير الوقت";
  if (locale === "he") return "שינוי שעה";
  return "Change time";
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

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: string;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <Icon size={17} strokeWidth={1.55} color={GOLD} />
      <h3
        className="m-0 text-[0.92rem] font-semibold"
        style={{ color: "#F3F4F5", lineHeight: 1.4 }}
      >
        {children}
      </h3>
    </div>
  );
}

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
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState("");

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
    setTimePickerOpen(false);
    setPendingDate("");
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
      if (e.key !== "Escape") return;
      if (timePickerOpen) {
        setTimePickerOpen(false);
        setPendingDate("");
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, timePickerOpen]);

  const serviceDays = useMemo(() => {
    return days.filter((d) => d.isOpen && daySupports(d, service));
  }, [days, service]);

  const availableSet = useMemo(
    () => new Set(serviceDays.map((d) => d.date)),
    [serviceDays],
  );

  const pickerDate = pendingDate || date;

  const selectedDay = useMemo(
    () => serviceDays.find((d) => d.date === pickerDate) || null,
    [serviceDays, pickerDate],
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

  const pendingDateLabel = useMemo(() => {
    if (!pickerDate) return "";
    try {
      return format(parseISO(pickerDate), "EEEE d MMMM yyyy", {
        locale: dateLocale,
      });
    } catch {
      return pickerDate;
    }
  }, [pickerDate, dateLocale]);

  const confirmedDateLabel = useMemo(() => {
    if (!date) return "";
    try {
      return format(parseISO(date), "d MMM yyyy", { locale: dateLocale });
    } catch {
      return date;
    }
  }, [date, dateLocale]);

  useEffect(() => {
    if (!date) return;
    if (!serviceDays.some((d) => d.date === date)) {
      setDate("");
      setTime("");
      setTimePickerOpen(false);
      setPendingDate("");
    }
  }, [service, serviceDays, date]);

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

  function openTimePicker(iso: string) {
    setPendingDate(iso);
    setTimePickerOpen(true);
  }

  function closeTimePicker() {
    setTimePickerOpen(false);
    setPendingDate("");
  }

  function selectTime(slotTime: string) {
    setDate(pendingDate || date);
    setTime(slotTime);
    setTimePickerOpen(false);
    setPendingDate("");
  }

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
    height: 44,
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: FIELD_BG,
    color: "#F3F4F5",
    padding: "0 0.75rem",
    font: "inherit",
    outline: "none",
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{ background: "rgba(11, 15, 20, 0.72)", padding: 12 }}
      onClick={() => {
        if (timePickerOpen) {
          closeTimePicker();
          return;
        }
        onClose();
      }}
      role="presentation"
    >
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: "calc(100vw - 24px)",
          maxWidth: 520,
          maxHeight: "88dvh",
          background: PAGE_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
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
              className="m-0 text-[1.12rem] font-semibold tracking-[-0.02em]"
              style={{ color: "#F5F6F7", lineHeight: 1.4 }}
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
            className="grid shrink-0 place-items-center rounded-[10px]"
            style={{
              width: 34,
              height: 34,
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
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5"
            style={{ display: "flex", flexDirection: "column", gap: 15 }}
          >
            {/* Service */}
            <section>
              <SectionTitle icon={Eye}>
                {sectionAppointmentDetails(locale)}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((type) => {
                  const selected = service === type;
                  const Icon = SERVICE_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setService(type)}
                      className="flex items-center gap-2 rounded-[12px] px-2.5 text-start transition"
                      style={{
                        height: 66,
                        border: selected
                          ? "1px solid rgba(212,175,106,0.7)"
                          : `1px solid ${BORDER}`,
                        background: selected
                          ? "rgba(212,175,106,0.12)"
                          : FIELD_BG,
                        color: selected ? GOLD : "#F0F1F2",
                      }}
                    >
                      <Icon size={17} strokeWidth={1.55} color={GOLD} />
                      <span className="text-[0.8rem] font-semibold leading-snug">
                        {serviceLabel(type)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Date */}
            <section>
              <SectionTitle icon={CalendarDays}>
                {sectionChooseDate(locale)}
              </SectionTitle>
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

                <div className="mb-1.5 grid grid-cols-7 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const label = t(`eyeExam.weekdays.${d}`);
                    return (
                      <span
                        key={d}
                        className="truncate text-center text-[0.62rem] font-semibold"
                        style={{ color: "rgba(212,175,106,0.9)" }}
                        title={label}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                {loading ? (
                  <p className="py-4 text-center text-sm" style={{ color: MUTED }}>
                    {t("admin.bookings.loadingDates")}
                  </p>
                ) : serviceDays.length === 0 ? (
                  <p className="py-4 text-center text-sm" style={{ color: MUTED }}>
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
                      const selected = date === iso && Boolean(time);
                      const pending = pendingDate === iso && timePickerOpen;
                      return (
                        <button
                          key={iso + String(inMonth)}
                          type="button"
                          disabled={disabled}
                          onClick={() => openTimePicker(iso)}
                          className={cn(
                            "rounded-[9px] text-[0.8rem] font-semibold transition",
                            !inMonth && "opacity-20",
                            disabled && inMonth && "cursor-not-allowed opacity-30",
                          )}
                          style={{
                            width: "100%",
                            height: 36,
                            ...(selected || pending
                              ? {
                                  border: `1px solid ${GOLD}`,
                                  background:
                                    selected
                                      ? GOLD
                                      : "rgba(212,175,106,0.18)",
                                  color: selected ? "#1A140C" : GOLD,
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
                                  }),
                          }}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected date + time summary (not the slot grid) */}
              {date && time ? (
                <button
                  type="button"
                  onClick={() => openTimePicker(date)}
                  className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-[12px] px-3 text-start"
                  style={{
                    height: 44,
                    background: FIELD_BG,
                    border: "1px solid rgba(212,175,106,0.4)",
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Clock3 size={16} strokeWidth={1.55} color={GOLD} />
                    <span className="truncate text-[0.84rem] font-semibold" style={{ color: "#F3F4F5" }}>
                      <span style={{ color: GOLD }}>{confirmedDateLabel}</span>
                      <span style={{ color: MUTED }}> · </span>
                      <span style={{ color: GOLD }}>{time}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.72rem] font-semibold" style={{ color: GOLD }}>
                    {changeTimeLabel(locale)}
                  </span>
                </button>
              ) : null}
            </section>

            {/* Customer */}
            <section>
              <SectionTitle icon={UserRound}>
                {sectionCustomer(locale)}
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      className="mb-1.5 block text-[0.76rem] font-medium"
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
                      className="mb-1.5 block text-[0.76rem] font-medium"
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
                    className="mb-1.5 block text-[0.76rem] font-medium"
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
                    className="mb-1.5 block text-[0.76rem] font-medium"
                    style={{ color: MUTED }}
                    htmlFor="mb-notes"
                  >
                    {t("admin.bookings.notes")}
                  </label>
                  <textarea
                    id="mb-notes"
                    style={{
                      ...fieldStyle,
                      height: "auto",
                      minHeight: 68,
                      padding: "0.65rem 0.75rem",
                      resize: "vertical",
                    }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("admin.bookings.notesPlaceholder")}
                    rows={2}
                  />
                </div>
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
              className="inline-flex min-w-0 flex-1 items-center justify-center rounded-[12px] text-[0.9rem] font-semibold disabled:opacity-50"
              style={{
                height: 48,
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
              className="inline-flex shrink-0 items-center justify-center rounded-[12px] px-4 text-[0.84rem] font-semibold"
              style={{
                height: 48,
                background: FIELD_BG,
                border: `1px solid ${BORDER}`,
                color: "#E8EAED",
              }}
            >
              {t("admin.bookings.cancel")}
            </button>
          </div>
        </form>

        {/* Time selection popup — above booking modal */}
        {timePickerOpen ? (
          <div
            className="absolute inset-0 z-20 flex items-end justify-center sm:items-center"
            style={{ background: "rgba(8, 10, 14, 0.62)", padding: 12 }}
            onClick={closeTimePicker}
            role="presentation"
          >
            <div
              className="w-full overflow-hidden"
              style={{
                maxWidth: 420,
                maxHeight: "70dvh",
                background: PAGE_BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={sectionChooseTime(locale)}
            >
              <div className="px-4 pb-3 pt-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid shrink-0 place-items-center rounded-[10px]"
                    style={{
                      width: 34,
                      height: 34,
                      background: "rgba(212,175,106,0.08)",
                      border: "1px solid rgba(212,175,106,0.35)",
                      color: GOLD,
                    }}
                  >
                    <Clock3 size={16} strokeWidth={1.55} />
                  </span>
                  <div className="min-w-0">
                    <h3
                      className="m-0 text-[1rem] font-semibold"
                      style={{ color: "#F5F6F7", lineHeight: 1.35 }}
                    >
                      {sectionChooseTime(locale)}
                    </h3>
                    <p
                      className="mb-0 mt-0.5 truncate text-[0.78rem]"
                      style={{ color: MUTED }}
                    >
                      {pendingDateLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="overflow-y-auto px-4 pb-3"
                style={{ maxHeight: "46dvh" }}
              >
                {availableSlots.length === 0 ? (
                  <p
                    className="mb-0 rounded-[12px] px-3 py-4 text-center text-[0.84rem]"
                    style={{ color: MUTED, border: `1px dashed ${BORDER}` }}
                  >
                    {t("admin.bookings.noAvailableTimes")}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => {
                      const selected =
                        time === slot.time && date === pickerDate;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => selectTime(slot.time)}
                          className="rounded-[11px] text-center text-[0.86rem] font-bold tabular-nums transition"
                          style={{
                            height: 42,
                            ...(selected
                              ? {
                                  border: `1px solid ${GOLD}`,
                                  background: "rgba(212,175,106,0.16)",
                                  color: GOLD,
                                }
                              : {
                                  border: `1px solid ${BORDER}`,
                                  background: FIELD_BG,
                                  color: "#F0F1F2",
                                }),
                          }}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className="px-4 py-3"
                style={{ borderTop: `1px solid ${BORDER}` }}
              >
                <button
                  type="button"
                  onClick={closeTimePicker}
                  className="inline-flex w-full items-center justify-center rounded-[12px] text-[0.86rem] font-semibold"
                  style={{
                    height: 44,
                    background: FIELD_BG,
                    border: `1px solid ${BORDER}`,
                    color: "#E8EAED",
                  }}
                >
                  {backLabel(locale)}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
