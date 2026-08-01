"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";

type DateOption = { date: string; label: string };

type SuccessPayload = {
  firstName: string;
  lastName: string;
  dateLabel: string;
  appointmentTime: string;
};

export default function EyeExamBookingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale, rtl } = useLocale();
  const titleId = useId();
  const [dates, setDates] = useState<DateOption[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    document.body.classList.toggle("eye-exam-booking-open", open);
    return () => document.body.classList.remove("eye-exam-booking-open");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (!open) return;
    setSuccess(null);
    setError("");
    setFieldErrors({});
    setLoadingDates(true);
    fetch("/api/eye-exam/available-dates")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("eyeExam.errorLoad"));
        setDates(data.dates || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("eyeExam.errorLoad"));
        setDates([]);
      })
      .finally(() => setLoadingDates(false));
  }, [open, t]);

  useEffect(() => {
    if (!open || !date) {
      setTimes([]);
      setTime("");
      return;
    }
    setLoadingTimes(true);
    setTime("");
    setError("");
    fetch(`/api/eye-exam/available-times?date=${encodeURIComponent(date)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("eyeExam.errorLoad"));
        setTimes(data.times || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("eyeExam.errorLoad"));
        setTimes([]);
      })
      .finally(() => setLoadingTimes(false));
  }, [date, open, t]);

  function validateClient(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = t("validation.required");
    if (!lastName.trim()) next.lastName = t("validation.required");
    if (!email.trim()) next.email = t("validation.required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t("validation.email");
    }
    if (!phone.trim()) next.phone = t("validation.required");
    else if (!normalizePhoneHint(phone)) next.phone = t("validation.phone");
    if (!date) next.appointmentDate = t("eyeExam.errors.dateRequired");
    if (!time) next.appointmentTime = t("eyeExam.errors.timeRequired");
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!validateClient()) return;

    setSubmitting(true);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.field) {
          setFieldErrors({ [data.field]: mapApiError(data.error, t) });
        }
        throw new Error(data.error || t("eyeExam.errorSubmit"));
      }
      setSuccess({
        firstName: data.appointment.firstName,
        lastName: data.appointment.lastName,
        dateLabel: data.appointment.dateLabel,
        appointmentTime: data.appointment.appointmentTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("eyeExam.errorSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const selectedLabel = dates.find((d) => d.date === date)?.label || date;

  return (
    <div className="eye-exam-modal-root" role="presentation">
      <button
        type="button"
        className="eye-exam-modal-backdrop"
        aria-label={t("common.close")}
        onClick={() => !submitting && onClose()}
      />
      <div
        className="eye-exam-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        dir={rtl ? "rtl" : "ltr"}
      >
        <div className="eye-exam-modal-header">
          <h2 id={titleId}>{t("eyeExam.formTitle")}</h2>
          <button
            type="button"
            className="eye-exam-modal-close"
            onClick={() => !submitting && onClose()}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="eye-exam-modal-body">
          {success ? (
            <div className="eye-exam-success">
              <p className="eye-exam-success-title">{t("eyeExam.successTitle")}</p>
              <p className="eye-exam-success-lead">{t("eyeExam.successLead")}</p>
              <dl className="eye-exam-success-meta">
                <div>
                  <dt>{t("common.name")}</dt>
                  <dd>
                    {success.firstName} {success.lastName}
                  </dd>
                </div>
                <div>
                  <dt>{t("common.date")}</dt>
                  <dd>{success.dateLabel}</dd>
                </div>
                <div>
                  <dt>{t("common.time")}</dt>
                  <dd>{success.appointmentTime}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn-copper eye-exam-btn" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          ) : (
            <form className="eye-exam-form" onSubmit={onSubmit} noValidate>
              <div className="eye-exam-form-grid">
                <label>
                  <span>{t("eyeExam.fields.firstName")}</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    required
                  />
                  {fieldErrors.firstName ? (
                    <em>{fieldErrors.firstName}</em>
                  ) : null}
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
                    inputMode="email"
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
                    inputMode="tel"
                    placeholder="0501234567"
                    required
                  />
                  {fieldErrors.phone ? <em>{fieldErrors.phone}</em> : null}
                </label>
              </div>

              <div className="eye-exam-select-block">
                <p className="eye-exam-select-label">{t("eyeExam.fields.date")}</p>
                {loadingDates ? (
                  <p className="eye-exam-muted">{t("common.loading")}</p>
                ) : dates.length === 0 ? (
                  <p className="eye-exam-muted">{t("eyeExam.emptyDates")}</p>
                ) : (
                  <div className="eye-exam-chip-row" role="listbox" aria-label={t("eyeExam.fields.date")}>
                    {dates.map((item) => (
                      <button
                        key={item.date}
                        type="button"
                        role="option"
                        aria-selected={date === item.date}
                        className={`eye-exam-chip ${date === item.date ? "is-active" : ""}`}
                        onClick={() => setDate(item.date)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
                {fieldErrors.appointmentDate ? (
                  <em className="eye-exam-field-error">{fieldErrors.appointmentDate}</em>
                ) : null}
              </div>

              <div className="eye-exam-select-block">
                <p className="eye-exam-select-label">{t("eyeExam.fields.time")}</p>
                {!date ? (
                  <p className="eye-exam-muted">{t("eyeExam.pickDateFirst")}</p>
                ) : loadingTimes ? (
                  <p className="eye-exam-muted">{t("common.loading")}</p>
                ) : times.length === 0 ? (
                  <p className="eye-exam-muted">{t("eyeExam.emptyTimes")}</p>
                ) : (
                  <div className="eye-exam-chip-row" role="listbox" aria-label={t("eyeExam.fields.time")}>
                    {times.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        role="option"
                        aria-selected={time === slot}
                        className={`eye-exam-chip ${time === slot ? "is-active" : ""}`}
                        onClick={() => setTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                {fieldErrors.appointmentTime ? (
                  <em className="eye-exam-field-error">{fieldErrors.appointmentTime}</em>
                ) : null}
              </div>

              {date && time ? (
                <p className="eye-exam-selection-summary">
                  {t("eyeExam.selectedSummary")
                    .replace("{date}", selectedLabel)
                    .replace("{time}", time)}
                </p>
              ) : null}

              {error ? <p className="eye-exam-form-error">{error}</p> : null}

              <button
                type="submit"
                className="btn btn-copper eye-exam-btn"
                disabled={submitting || loadingDates}
              >
                {submitting ? t("eyeExam.submitting") : t("eyeExam.fields.confirm")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizePhoneHint(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (/^05\d{8}$/.test(digits)) return true;
  if (/^9725\d{8}$/.test(digits)) return true;
  if (/^5\d{8}$/.test(digits)) return true;
  return false;
}

function mapApiError(message: string, t: (key: string) => string): string {
  if (/email/i.test(message)) return t("validation.email");
  if (/phone/i.test(message)) return t("validation.phone");
  if (/date/i.test(message)) return t("eyeExam.errors.dateRequired");
  if (/time|slot/i.test(message)) return t("eyeExam.errors.timeRequired");
  return message || t("validation.generic");
}
