"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
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
  FileText,
  Glasses,
  Phone,
  Sun,
  User,
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
    <div className="amb-card-title">
      <span className="amb-card-title-icon" aria-hidden>
        <Icon size={16} strokeWidth={1.55} />
      </span>
      <h3>{children}</h3>
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

  return (
    <div
      className="amb-overlay"
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
        className="amb-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.bookings.manualTitle")}
      >
        <div className="amb-header">
          <div className="amb-header-copy">
            <div className="amb-header-title">
              <span className="amb-card-title-icon" aria-hidden>
                <CalendarDays size={16} strokeWidth={1.55} />
              </span>
              <h2>{t("admin.bookings.manualTitle")}</h2>
            </div>
            <p>{t("admin.bookings.manualKicker")}</p>
          </div>
          <button
            type="button"
            className="amb-close"
            onClick={onClose}
            aria-label={t("admin.bookings.close")}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        {error ? <p className="amb-error">{error}</p> : null}

        <form
          onSubmit={(e) => void confirmBooking(e)}
          className="amb-form"
        >
          <div className="amb-body">
            <section className="amb-card">
              <SectionTitle icon={Eye}>
                {sectionAppointmentDetails(locale)}
              </SectionTitle>
              <div className="amb-services">
                {SERVICES.map((type) => {
                  const selected = service === type;
                  const Icon = SERVICE_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setService(type)}
                      className={cn("amb-service", selected && "is-selected")}
                    >
                      <span className="amb-service-icon" aria-hidden>
                        <Icon size={16} strokeWidth={1.55} />
                      </span>
                      <span>{serviceLabel(type)}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="amb-card">
              <SectionTitle icon={CalendarDays}>
                {sectionChooseDate(locale)}
              </SectionTitle>
              <div className="amb-cal">
                <div className="amb-cal-head">
                  <button
                    type="button"
                    className="amb-cal-nav"
                    aria-label={t("clinicBooking.prevMonth")}
                    onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                  >
                    {rtl ? (
                      <ChevronRight size={15} strokeWidth={1.6} />
                    ) : (
                      <ChevronLeft size={15} strokeWidth={1.6} />
                    )}
                  </button>
                  <strong>{monthLabel}</strong>
                  <button
                    type="button"
                    className="amb-cal-nav"
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

                <div className="amb-cal-week">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                    const label = t(`eyeExam.weekdays.${d}`);
                    return (
                      <span key={d} title={label}>
                        {label}
                      </span>
                    );
                  })}
                </div>

                {loading ? (
                  <p className="amb-cal-msg">
                    {t("admin.bookings.loadingDates")}
                  </p>
                ) : serviceDays.length === 0 ? (
                  <p className="amb-cal-msg">{t("admin.bookings.noDates")}</p>
                ) : (
                  <div className="amb-cal-grid">
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
                            "amb-cal-day",
                            !inMonth && "is-outside",
                            disabled && inMonth && "is-unavailable",
                            selected && "is-selected",
                            pending && "is-pending",
                          )}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {date && time ? (
                <button
                  type="button"
                  onClick={() => openTimePicker(date)}
                  className="amb-time-summary"
                >
                  <span>
                    <Clock3 size={15} strokeWidth={1.55} />
                    <span>
                      {confirmedDateLabel}
                      {" · "}
                      {time}
                    </span>
                  </span>
                  <em>{changeTimeLabel(locale)}</em>
                </button>
              ) : null}
            </section>

            <section className="amb-card">
              <SectionTitle icon={UserRound}>
                {sectionCustomer(locale)}
              </SectionTitle>
              <div className="amb-fields">
                <div className="amb-fields-row">
                  <label className="amb-field" htmlFor="mb-first">
                    <span>{t("admin.bookings.firstName")}</span>
                    <span className="amb-control">
                      <User size={15} strokeWidth={1.55} aria-hidden />
                      <input
                        id="mb-first"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        autoComplete="given-name"
                      />
                    </span>
                  </label>
                  <label className="amb-field" htmlFor="mb-last">
                    <span>{t("admin.bookings.lastName")}</span>
                    <span className="amb-control">
                      <UserRound size={15} strokeWidth={1.55} aria-hidden />
                      <input
                        id="mb-last"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        autoComplete="family-name"
                      />
                    </span>
                  </label>
                </div>
                <label className="amb-field amb-field-phone" htmlFor="mb-phone">
                  <span>{t("admin.bookings.phone")}</span>
                  <span className="amb-control">
                    <Phone size={15} strokeWidth={1.55} aria-hidden />
                    <input
                      id="mb-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      required
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={10}
                      size={15}
                    />
                  </span>
                </label>
                <label className="amb-field" htmlFor="mb-notes">
                  <span>{t("admin.bookings.notes")}</span>
                  <span className="amb-control amb-control-notes">
                    <FileText size={15} strokeWidth={1.55} aria-hidden />
                    <textarea
                      id="mb-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("admin.bookings.notesPlaceholder")}
                      rows={2}
                    />
                  </span>
                </label>
              </div>
            </section>
          </div>

          <div className="amb-actions">
            <button
              type="submit"
              disabled={!canSubmit}
              className="amb-confirm"
            >
              {saving
                ? t("admin.bookings.confirming")
                : t("admin.bookings.confirmBooking")}
            </button>
            <button type="button" onClick={onClose} className="amb-cancel">
              {t("admin.bookings.cancel")}
            </button>
          </div>
        </form>

        {timePickerOpen ? (
          <div
            className="amb-time-overlay"
            onClick={closeTimePicker}
            role="presentation"
          >
            <div
              className="amb-time-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={sectionChooseTime(locale)}
            >
              <div className="amb-time-head">
                <span className="amb-card-title-icon" aria-hidden>
                  <Clock3 size={16} strokeWidth={1.55} />
                </span>
                <div>
                  <h3>{sectionChooseTime(locale)}</h3>
                  <p>{pendingDateLabel}</p>
                </div>
              </div>

              <div className="amb-time-body">
                {availableSlots.length === 0 ? (
                  <p className="amb-cal-msg">
                    {t("admin.bookings.noAvailableTimes")}
                  </p>
                ) : (
                  <div className="amb-time-grid">
                    {availableSlots.map((slot) => {
                      const selected =
                        time === slot.time && date === pickerDate;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => selectTime(slot.time)}
                          className={cn(
                            "amb-time-slot",
                            selected && "is-selected",
                          )}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="amb-time-foot">
                <button
                  type="button"
                  onClick={closeTimePicker}
                  className="amb-cancel amb-cancel-block"
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
