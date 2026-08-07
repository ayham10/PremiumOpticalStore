"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Glasses,
  MessageCircle,
  Phone,
  Sparkles,
  Sun,
} from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  buildMonthGrid,
  formatClinicDateDisplay,
  groupTimesOfDay,
  resolveClinicTypeFromQuery,
} from "@/lib/clinic-booking";
import {
  bookingDatesCacheKey,
  bookingTimesCacheKey,
  cachedJsonFetch,
  invalidatePublicCache,
  peekPublicCache,
} from "@/lib/public-data-cache";
import type { ClinicAppointmentType } from "@/lib/types";

type Step = "service" | "schedule" | "success";

type DateOption = { date: string; label: string };

const SERVICE_META: Array<{
  type: ClinicAppointmentType;
  icon: typeof Eye;
  labelKey: string;
  hintKey: string;
}> = [
  {
    type: "eye_exam",
    icon: Eye,
    labelKey: "clinicBooking.services.eye_exam",
    hintKey: "clinicBooking.serviceHints.eye_exam",
  },
  {
    type: "contact_lens_fitting",
    icon: Sparkles,
    labelKey: "clinicBooking.services.contact_lens_fitting",
    hintKey: "clinicBooking.serviceHints.contact_lens_fitting",
  },
  {
    type: "frame_consultation",
    icon: Glasses,
    labelKey: "clinicBooking.services.frame_consultation",
    hintKey: "clinicBooking.serviceHints.frame_consultation",
  },
  {
    type: "sunglasses_consultation",
    icon: Sun,
    labelKey: "clinicBooking.services.sunglasses_consultation",
    hintKey: "clinicBooking.serviceHints.sunglasses_consultation",
  },
];

const COUNTRY_CODES = [{ value: "+972", label: "+972" }] as const;

function normalizePhoneHint(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    /^05\d{8}$/.test(digits) ||
    /^9725\d{8}$/.test(digits) ||
    /^5\d{8}$/.test(digits)
  );
}

function combinePhone(countryCode: string, local: string): string {
  const localDigits = local.replace(/\D/g, "");
  const ccDigits = countryCode.replace(/\D/g, "");
  if (!localDigits) return "";
  if (ccDigits === "972") {
    if (localDigits.startsWith("0")) return `972${localDigits.slice(1)}`;
    if (localDigits.startsWith("972")) return localDigits;
    return `972${localDigits}`;
  }
  return `${ccDigits}${localDigits}`;
}

/** Backend still expects email; UI no longer collects it. */
function syntheticEmail(phoneCombined: string): string {
  const digits = phoneCombined.replace(/\D/g, "") || "guest";
  return `booking.${digits}@oyon.guest`;
}

export default function ClinicBookingPage() {
  const { t, locale, rtl } = useLocale();
  const searchParams = useSearchParams();
  const preset = resolveClinicTypeFromQuery(
    searchParams.get("type"),
    searchParams.get("service"),
  );

  const [step, setStep] = useState<Step>(preset ? "schedule" : "service");
  const [appointmentType, setAppointmentType] =
    useState<ClinicAppointmentType | null>(preset);
  const [availableDates, setAvailableDates] = useState<DateOption[]>([]);
  const [availableSet, setAvailableSet] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("+972");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successLabel, setSuccessLabel] = useState("");

  const today = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const initialMonth = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m - 1 };
  }, [today]);

  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.month);
  const [datesEpoch, setDatesEpoch] = useState(0);

  useEffect(() => {
    if (preset) {
      setAppointmentType(preset);
      setStep("schedule");
    }
  }, [preset]);

  // Admin Working Hours / exceptions → refresh public calendar immediately
  useEffect(() => {
    function onScheduleChanged() {
      invalidatePublicCache("booking-");
      setDatesEpoch((n) => n + 1);
    }
    window.addEventListener("oyon:branding-saved", onScheduleChanged);
    window.addEventListener("oyon:availability-saved", onScheduleChanged);
    return () => {
      window.removeEventListener("oyon:branding-saved", onScheduleChanged);
      window.removeEventListener("oyon:availability-saved", onScheduleChanged);
    };
  }, []);

  useEffect(() => {
    if (!appointmentType || step !== "schedule") return;
    let cancelled = false;
    const key = bookingDatesCacheKey(appointmentType);
    const cached = peekPublicCache<{ dates: DateOption[] }>(key, 8_000, {
      allowStale: true,
    });
    if (cached?.dates?.length) {
      setAvailableDates(cached.dates);
      setAvailableSet(new Set(cached.dates.map((d) => d.date)));
      setLoadingDates(false);
      const [y, m] = cached.dates[0].date.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    } else {
      setLoadingDates(true);
    }
    setError("");

    cachedJsonFetch<{ dates: DateOption[] }>(
      key,
      `/api/eye-exam/available-dates?type=${encodeURIComponent(appointmentType)}`,
      { ttlMs: 0, revalidate: true },
    )
      .then((data) => {
        if (cancelled) return;
        const dates = data.dates || [];
        setAvailableDates(dates);
        setAvailableSet(new Set(dates.map((d) => d.date)));
        if (dates[0] && !cached?.dates?.length) {
          const [y, m] = dates[0].date.split("-").map(Number);
          setViewYear(y);
          setViewMonth(m - 1);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("clinicBooking.errorLoad"));
          setAvailableDates([]);
          setAvailableSet(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentType, step, t, datesEpoch]);

  useEffect(() => {
    if (!appointmentType || !date || step !== "schedule") {
      return;
    }
    let cancelled = false;
    const key = bookingTimesCacheKey(appointmentType, date);
    const cached = peekPublicCache<{ times: string[] }>(key, 8_000);
    if (cached?.times) {
      setTimes(cached.times);
      setLoadingTimes(false);
    } else {
      setLoadingTimes(true);
      setTimes([]);
    }
    setTime("");
    setError("");

    cachedJsonFetch<{ times: string[] }>(
      key,
      `/api/eye-exam/available-times?date=${encodeURIComponent(date)}&type=${encodeURIComponent(appointmentType)}`,
      { ttlMs: 0, revalidate: true },
    )
      .then((data) => {
        if (!cancelled) setTimes(data.times || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("clinicBooking.errorLoad"));
          setTimes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTimes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentType, date, step, t]);

  const monthLabel = useMemo(() => {
    const localeTag = locale === "ar" ? "ar" : locale === "he" ? "he" : "en-GB";
    return new Intl.DateTimeFormat(localeTag, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(viewYear, viewMonth, 1)));
  }, [locale, viewMonth, viewYear]);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewMonth, viewYear],
  );

  const grouped = useMemo(() => groupTimesOfDay(times), [times]);

  const serviceLabel = appointmentType
    ? t(`clinicBooking.services.${appointmentType}`)
    : "";

  const whatsappHref = `https://wa.me/9725550180?text=${encodeURIComponent(
    locale === "ar"
      ? "مرحباً عيون، أود الاستفسار عن حجز موعد."
      : "Hello Oyon, I would like help with booking.",
  )}`;

  function validateSchedule(): boolean {
    const next: Record<string, string> = {};
    if (!date) next.date = t("eyeExam.errors.dateRequired");
    if (!time) next.time = t("eyeExam.errors.timeRequired");
    if (!firstName.trim()) next.firstName = t("validation.required");
    if (!lastName.trim()) next.lastName = t("validation.required");
    const combined = combinePhone(countryCode, phoneLocal);
    if (!phoneLocal.trim()) next.phone = t("validation.required");
    else if (!normalizePhoneHint(combined) && !normalizePhoneHint(phoneLocal)) {
      next.phone = t("validation.phone");
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function confirmBooking(e?: FormEvent) {
    e?.preventDefault();
    if (!appointmentType || submitting) return;
    if (!validateSchedule()) return;

    const phone = combinePhone(countryCode, phoneLocal);
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/eye-exam/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: syntheticEmail(phone),
          phone,
          appointmentDate: date,
          appointmentTime: time,
          language: locale,
          appointmentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("clinicBooking.errorSubmit"));
      invalidatePublicCache("booking-");
      setSuccessLabel(data.appointment?.dateLabel || formatClinicDateDisplay(date));
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clinicBooking.errorSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  const stepNumber = step === "service" ? 1 : 2;

  return (
    <div className="clinic-book-page" dir={rtl ? "rtl" : "ltr"}>
      <div className="clinic-book-inner wrap">
        <header className="clinic-book-header">
          {step !== "success" ? (
            <div className="clinic-book-progress" aria-label={t("clinicBooking.progress")}>
              <div className="clinic-book-progress-track">
                <span className={`clinic-book-progress-node${stepNumber >= 1 ? " is-active" : ""}${stepNumber > 1 ? " is-done" : ""}`}>
                  {stepNumber > 1 ? <Check size={12} strokeWidth={2.4} /> : "1"}
                </span>
                <span className={`clinic-book-progress-line${stepNumber > 1 ? " is-active" : ""}`} />
                <span className={`clinic-book-progress-node${stepNumber >= 2 ? " is-active" : ""}`}>
                  2
                </span>
              </div>
              <p className="clinic-book-progress-label">
                {t("clinicBooking.stepOf", { current: stepNumber, total: 2 })}
              </p>
            </div>
          ) : null}
          <h1 className="clinic-book-title">
            {step === "service"
              ? t("clinicBooking.askService")
              : step === "schedule"
                ? t("clinicBooking.scheduleTitle")
                : t("clinicBooking.successTitle")}
          </h1>
        </header>

        <section className="clinic-book-card">
          {step === "service" ? (
            <>
              <div className="clinic-book-service-list" role="radiogroup" aria-label={t("clinicBooking.askService")}>
                {SERVICE_META.map((item) => {
                  const selected = appointmentType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`clinic-book-service${selected ? " is-selected" : ""}`}
                      onClick={() => setAppointmentType(item.type)}
                    >
                      <span className={`clinic-book-service-check${selected ? " is-on" : ""}`} aria-hidden>
                        {selected ? <Check size={12} strokeWidth={2.5} /> : null}
                      </span>
                      <span className="clinic-book-service-copy">
                        <strong>{t(item.labelKey)}</strong>
                        <span>{t(item.hintKey)}</span>
                      </span>
                      <item.icon className="clinic-book-service-icon" size={20} aria-hidden />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-copper clinic-book-cta"
                disabled={!appointmentType}
                onClick={() => {
                  if (!appointmentType) return;
                  setDate("");
                  setTime("");
                  setStep("schedule");
                }}
              >
                <span>{t("clinicBooking.next")}</span>
                {rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </>
          ) : null}

          {step === "schedule" && appointmentType ? (
            <form className="clinic-book-schedule" onSubmit={(e) => void confirmBooking(e)} noValidate>
              <div className="clinic-book-schedule-panel">
                <div className="clinic-cal">
                  <p className="clinic-panel-label">{t("clinicBooking.selectDate")}</p>
                  <div className="clinic-cal-nav">
                    <button
                      type="button"
                      aria-label={t("clinicBooking.prevMonth")}
                      onClick={() => {
                        if (viewMonth === 0) {
                          setViewMonth(11);
                          setViewYear((y) => y - 1);
                        } else setViewMonth((m) => m - 1);
                      }}
                    >
                      {rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                    <strong>{monthLabel}</strong>
                    <button
                      type="button"
                      aria-label={t("clinicBooking.nextMonth")}
                      onClick={() => {
                        if (viewMonth === 11) {
                          setViewMonth(0);
                          setViewYear((y) => y + 1);
                        } else setViewMonth((m) => m + 1);
                      }}
                    >
                      {rtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                  <div className="clinic-cal-weekdays">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                      const label = t(`eyeExam.weekdays.${d}`);
                      // Arabic/Hebrew need the full weekday name; Latin can stay compact
                      const display =
                        locale === "ar" || locale === "he"
                          ? label
                          : label.slice(0, 2);
                      return (
                        <span key={d} title={label}>
                          {display}
                        </span>
                      );
                    })}
                  </div>
                  <div
                    className={`clinic-cal-grid${loadingDates ? " is-loading" : ""}`}
                    role="grid"
                    aria-busy={loadingDates}
                  >
                    {grid.map((cell, idx) => {
                      if (!cell.iso || cell.day == null) {
                        return <span key={`e-${idx}`} className="clinic-cal-empty" />;
                      }
                      const disabled =
                        loadingDates ||
                        cell.iso < today ||
                        !availableSet.has(cell.iso);
                      const selected = date === cell.iso;
                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={disabled}
                          className={`clinic-cal-day ${selected ? "is-selected" : ""} ${
                            disabled ? "is-disabled" : "is-available"
                          }`}
                          onClick={() => {
                            setDate(cell.iso!);
                            setTime("");
                          }}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                  {loadingDates ? (
                    <div className="clinic-cal-skeleton" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}
                  {!loadingDates && availableDates.length === 0 ? (
                    <p className="clinic-book-muted">{t("clinicBooking.emptyDates")}</p>
                  ) : null}
                  {fieldErrors.date ? (
                    <em className="clinic-book-field-error">{fieldErrors.date}</em>
                  ) : null}
                </div>

                <div className="clinic-book-times">
                  <p className="clinic-panel-label">{t("clinicBooking.selectTime")}</p>
                  {loadingTimes ? (
                    <div className="clinic-time-skeleton" aria-hidden>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <span key={i} />
                      ))}
                    </div>
                  ) : !date ? (
                    <p className="clinic-book-muted">{t("eyeExam.pickDateFirst")}</p>
                  ) : times.length === 0 ? (
                    <p className="clinic-book-muted">{t("clinicBooking.emptyTimes")}</p>
                  ) : (
                    <div className="clinic-time-grid">
                      {times.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`clinic-time-chip${time === slot ? " is-active" : ""}`}
                          onClick={() => setTime(slot)}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                  {fieldErrors.time ? (
                    <em className="clinic-book-field-error">{fieldErrors.time}</em>
                  ) : null}
                </div>
              </div>

              <div
                className="clinic-book-pick-summary"
                aria-label={t("clinicBooking.reviewTitle")}
              >
                <span>
                  <CalendarDays size={14} aria-hidden />
                  <strong>{date ? formatClinicDateDisplay(date) : "—"}</strong>
                </span>
                <span className="clinic-book-pick-dot" aria-hidden />
                <span>
                  <Clock3 size={14} aria-hidden />
                  <strong>{time || "—"}</strong>
                </span>
              </div>

              <div className="clinic-book-form">
                <h2 className="clinic-book-form-title">{t("clinicBooking.yourDetails")}</h2>
                <div className="clinic-book-name-row">
                  <label>
                    <span>{t("eyeExam.fields.firstName")}</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      required
                    />
                    {fieldErrors.firstName ? <em>{fieldErrors.firstName}</em> : null}
                  </label>
                  <label>
                    <span>{t("eyeExam.fields.lastName")}</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      required
                    />
                    {fieldErrors.lastName ? <em>{fieldErrors.lastName}</em> : null}
                  </label>
                </div>

                <div className="clinic-book-phone-row">
                  <label className="clinic-book-country">
                    <span className="sr-only">{t("clinicBooking.countryCode")}</span>
                    <span className="clinic-book-country-control">
                      <Phone size={13} aria-hidden />
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        aria-label={t("clinicBooking.countryCode")}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="clinic-book-phone">
                    <span className="sr-only">{t("eyeExam.fields.phone")}</span>
                    <input
                      type="tel"
                      value={phoneLocal}
                      onChange={(e) => setPhoneLocal(e.target.value)}
                      autoComplete="tel-national"
                      placeholder={t("clinicBooking.phonePlaceholder")}
                      required
                    />
                    {fieldErrors.phone ? <em>{fieldErrors.phone}</em> : null}
                  </label>
                </div>
              </div>

              {error ? <p className="clinic-book-error">{error}</p> : null}

              <div className="clinic-book-actions">
                {!preset ? (
                  <button
                    type="button"
                    className="clinic-book-back-btn"
                    onClick={() => setStep("service")}
                    disabled={submitting}
                  >
                    {rtl ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    {t("common.back")}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  className="btn btn-copper clinic-book-cta clinic-book-cta--primary"
                  disabled={submitting}
                >
                  <CalendarCheck2 size={16} aria-hidden />
                  {submitting ? t("clinicBooking.submitting") : t("clinicBooking.confirm")}
                </button>
              </div>
            </form>
          ) : null}

          {step === "success" ? (
            <div className="clinic-book-success">
              <span className="clinic-book-success-icon" aria-hidden>
                <Check size={28} />
              </span>
              <h2>{t("clinicBooking.successTitle")}</h2>
              <p>{t("clinicBooking.successLead")}</p>
              <dl className="clinic-book-review">
                <div>
                  <dt>{t("clinicBooking.reviewService")}</dt>
                  <dd>{serviceLabel}</dd>
                </div>
                <div>
                  <dt>{t("clinicBooking.reviewDate")}</dt>
                  <dd>{successLabel}</dd>
                </div>
                <div>
                  <dt>{t("clinicBooking.reviewTime")}</dt>
                  <dd>{time}</dd>
                </div>
              </dl>
              <Link href="/" className="btn btn-copper clinic-book-cta">
                {t("clinicBooking.backHome")}
              </Link>
            </div>
          ) : null}

          {error && step === "service" ? (
            <p className="clinic-book-error">{error}</p>
          ) : null}
        </section>

        {step !== "success" ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="clinic-book-whatsapp"
          >
            <MessageCircle size={15} aria-hidden />
            {t("clinicBooking.whatsappFooter")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
