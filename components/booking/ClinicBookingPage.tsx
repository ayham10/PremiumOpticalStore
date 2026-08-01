"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Glasses,
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
import type { ClinicAppointmentType } from "@/lib/types";

type Step = "service" | "date" | "time" | "details" | "review" | "success";

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

function normalizePhoneHint(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    /^05\d{8}$/.test(digits) ||
    /^9725\d{8}$/.test(digits) ||
    /^5\d{8}$/.test(digits)
  );
}

export default function ClinicBookingPage() {
  const { t, locale, rtl } = useLocale();
  const searchParams = useSearchParams();
  const preset = resolveClinicTypeFromQuery(
    searchParams.get("type"),
    searchParams.get("service"),
  );

  const [step, setStep] = useState<Step>(preset ? "date" : "service");
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  useEffect(() => {
    if (preset) {
      setAppointmentType(preset);
      setStep("date");
    }
  }, [preset]);

  useEffect(() => {
    if (!appointmentType || (step !== "date" && step !== "time")) return;
    let cancelled = false;
    setLoadingDates(true);
    setError("");
    fetch(
      `/api/eye-exam/available-dates?type=${encodeURIComponent(appointmentType)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("clinicBooking.errorLoad"));
        if (cancelled) return;
        const dates = (data.dates || []) as DateOption[];
        setAvailableDates(dates);
        setAvailableSet(new Set(dates.map((d) => d.date)));
        if (dates[0]) {
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
  }, [appointmentType, step, t]);

  useEffect(() => {
    if (!appointmentType || !date || step !== "time") {
      return;
    }
    let cancelled = false;
    setLoadingTimes(true);
    setTime("");
    setError("");
    fetch(
      `/api/eye-exam/available-times?date=${encodeURIComponent(date)}&type=${encodeURIComponent(appointmentType)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("clinicBooking.errorLoad"));
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

  function selectService(type: ClinicAppointmentType) {
    setAppointmentType(type);
    setDate("");
    setTime("");
    setStep("date");
  }

  function selectDate(iso: string) {
    setDate(iso);
    setTime("");
    setStep("time");
  }

  function validateDetails(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = t("validation.required");
    if (!lastName.trim()) next.lastName = t("validation.required");
    if (!email.trim()) next.email = t("validation.required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t("validation.email");
    }
    if (!phone.trim()) next.phone = t("validation.required");
    else if (!normalizePhoneHint(phone)) next.phone = t("validation.phone");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function confirmBooking() {
    if (!appointmentType || !date || !time || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/eye-exam/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          appointmentDate: date,
          appointmentTime: time,
          language: locale,
          appointmentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("clinicBooking.errorSubmit"));
      setSuccessLabel(data.appointment?.dateLabel || formatClinicDateDisplay(date));
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clinicBooking.errorSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  function onDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateDetails()) return;
    setStep("review");
  }

  const stepIndex =
    step === "service"
      ? 1
      : step === "date"
        ? 2
        : step === "time"
          ? 3
          : step === "details"
            ? 4
            : step === "review"
              ? 5
              : 5;

  return (
    <div className="clinic-book-page" dir={rtl ? "rtl" : "ltr"}>
      <div className="clinic-book-inner wrap">
        <header className="clinic-book-header">
          <p className="clinic-book-brand">{t("hero.brand")}</p>
          <h1 className="clinic-book-title">{t("clinicBooking.title")}</h1>
          <p className="clinic-book-lead">{t("clinicBooking.lead")}</p>
          {step !== "success" ? (
            <ol className="clinic-book-steps" aria-label={t("clinicBooking.progress")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <li
                  key={n}
                  className={`clinic-book-step-dot ${stepIndex >= n ? "is-active" : ""}`}
                >
                  <span>{n}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </header>

        <section className="clinic-book-card">
          {step === "service" ? (
            <>
              <h2 className="clinic-book-section-title">
                {t("clinicBooking.askService")}
              </h2>
              <div className="clinic-book-service-grid">
                {SERVICE_META.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className="clinic-book-service"
                    onClick={() => selectService(item.type)}
                  >
                    <item.icon size={22} aria-hidden />
                    <strong>{t(item.labelKey)}</strong>
                    <span>{t(item.hintKey)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === "date" && appointmentType ? (
            <>
              <div className="clinic-book-toolbar">
                {!preset ? (
                  <button
                    type="button"
                    className="clinic-book-back"
                    onClick={() => setStep("service")}
                  >
                    {rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {t("clinicBooking.changeService")}
                  </button>
                ) : (
                  <span className="clinic-book-pill">{serviceLabel}</span>
                )}
              </div>
              <h2 className="clinic-book-section-title">
                <CalendarDays size={18} aria-hidden />
                {t("clinicBooking.selectDate")}
              </h2>
              <div className="clinic-cal">
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
                    {rtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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
                    {rtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
                <div className="clinic-cal-weekdays">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <span key={d}>{t(`eyeExam.weekdays.${d}`).slice(0, 3)}</span>
                  ))}
                </div>
                {loadingDates ? (
                  <p className="clinic-book-muted">{t("common.loading")}</p>
                ) : (
                  <div className="clinic-cal-grid" role="grid">
                    {grid.map((cell, idx) => {
                      if (!cell.iso || cell.day == null) {
                        return <span key={`e-${idx}`} className="clinic-cal-empty" />;
                      }
                      const disabled =
                        cell.iso < today || !availableSet.has(cell.iso);
                      const selected = date === cell.iso;
                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          disabled={disabled}
                          className={`clinic-cal-day ${selected ? "is-selected" : ""} ${
                            disabled ? "is-disabled" : "is-available"
                          }`}
                          onClick={() => selectDate(cell.iso!)}
                        >
                          {cell.day}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!loadingDates && availableDates.length === 0 ? (
                  <p className="clinic-book-muted">{t("clinicBooking.emptyDates")}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {step === "time" && appointmentType ? (
            <>
              <div className="clinic-book-toolbar">
                <button
                  type="button"
                  className="clinic-book-back"
                  onClick={() => setStep("date")}
                >
                  {rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                  {t("clinicBooking.changeDate")}
                </button>
                <span className="clinic-book-pill">
                  {formatClinicDateDisplay(date)}
                </span>
              </div>
              <h2 className="clinic-book-section-title">
                <Clock3 size={18} aria-hidden />
                {t("clinicBooking.selectTime")}
              </h2>
              {loadingTimes ? (
                <p className="clinic-book-muted">{t("common.loading")}</p>
              ) : times.length === 0 ? (
                <p className="clinic-book-muted">{t("clinicBooking.emptyTimes")}</p>
              ) : (
                (["morning", "afternoon", "evening"] as const).map((group) => {
                  const slots = grouped[group];
                  if (!slots.length) return null;
                  return (
                    <div key={group} className="clinic-time-group">
                      <p className="clinic-time-label">
                        {t(`clinicBooking.periods.${group}`)}
                      </p>
                      <div className="clinic-time-grid">
                        {slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            className={`clinic-time-chip ${time === slot ? "is-active" : ""}`}
                            onClick={() => {
                              setTime(slot);
                              setStep("details");
                            }}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : null}

          {step === "details" ? (
            <>
              <div className="clinic-book-toolbar">
                <button
                  type="button"
                  className="clinic-book-back"
                  onClick={() => setStep("time")}
                >
                  {rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                  {t("clinicBooking.changeTime")}
                </button>
                <span className="clinic-book-pill">
                  {formatClinicDateDisplay(date)} · {time}
                </span>
              </div>
              <h2 className="clinic-book-section-title">
                {t("clinicBooking.yourDetails")}
              </h2>
              <form className="clinic-book-form" onSubmit={onDetailsSubmit} noValidate>
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
                <label>
                  <span>{t("eyeExam.fields.email")}</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  {fieldErrors.email ? <em>{fieldErrors.email}</em> : null}
                </label>
                <label>
                  <span>{t("eyeExam.fields.phone")}</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="0501234567"
                    required
                  />
                  {fieldErrors.phone ? <em>{fieldErrors.phone}</em> : null}
                </label>
                <button type="submit" className="btn btn-copper clinic-book-cta">
                  {t("clinicBooking.continueReview")}
                </button>
              </form>
            </>
          ) : null}

          {step === "review" ? (
            <>
              <h2 className="clinic-book-section-title">
                {t("clinicBooking.reviewTitle")}
              </h2>
              <dl className="clinic-book-review">
                <div>
                  <dt>{t("clinicBooking.reviewService")}</dt>
                  <dd>{serviceLabel}</dd>
                </div>
                <div>
                  <dt>{t("clinicBooking.reviewDate")}</dt>
                  <dd>{formatClinicDateDisplay(date)}</dd>
                </div>
                <div>
                  <dt>{t("clinicBooking.reviewTime")}</dt>
                  <dd>{time}</dd>
                </div>
                <div>
                  <dt>{t("clinicBooking.reviewCustomer")}</dt>
                  <dd>
                    {firstName} {lastName}
                    <br />
                    {email}
                    <br />
                    {phone}
                  </dd>
                </div>
              </dl>
              {error ? <p className="clinic-book-error">{error}</p> : null}
              <div className="clinic-book-actions">
                <button
                  type="button"
                  className="btn clinic-book-secondary"
                  onClick={() => setStep("details")}
                  disabled={submitting}
                >
                  {t("common.back")}
                </button>
                <button
                  type="button"
                  className="btn btn-copper clinic-book-cta"
                  onClick={() => void confirmBooking()}
                  disabled={submitting}
                >
                  {submitting
                    ? t("clinicBooking.submitting")
                    : t("clinicBooking.confirm")}
                </button>
              </div>
            </>
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

          {error && step !== "review" && step !== "success" ? (
            <p className="clinic-book-error">{error}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
