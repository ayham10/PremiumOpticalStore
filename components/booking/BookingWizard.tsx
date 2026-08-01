"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { addDays, format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import type { ServiceType } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/components/i18n/LocaleProvider";

type PublicStaff = {
  id: string;
  name: string;
  title: string;
  specialties: ServiceType[];
  color: string;
  bio?: string;
  image?: string;
};

type PublicService = {
  key: ServiceType;
  title: string;
  description: string;
  image: string;
};

type BookingOptions = {
  services: PublicService[];
  staff: PublicStaff[];
  appointmentSlotMinutes: number;
  bookingLeadDays: number;
};

type AppointmentResult = {
  id: string;
  service: ServiceType;
  staffId: string;
  staffName?: string | null;
  customerName: string;
  customerEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  manageToken: string;
};

const STEP_KEYS = [
  "service",
  "doctor",
  "date",
  "time",
  "details",
] as const;

const stepMotion = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

export default function BookingWizard({
  initialService,
}: {
  initialService?: string | null;
}) {
  const { t } = useLocale();

  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState(0);

  const [service, setService] = useState<ServiceType | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AppointmentResult | null>(null);

  function translateServiceField(
    serviceKey: string,
    field: "title" | "description",
    fallback: string
  ) {
    const path = `servicesPage.items.${serviceKey}.${field}`;
    const translated = t(path);
    return translated === path ? fallback : translated;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/booking/options");
        if (!res.ok) throw new Error("Failed to load booking options");
        const data = (await res.json()) as BookingOptions;
        if (cancelled) return;
        setOptions(data);

        if (initialService) {
          const match = data.services.find(
            (s) =>
              s.key === initialService ||
              s.title.toLowerCase() === initialService.toLowerCase()
          );
          if (match) {
            setService(match.key);
            setStep(1);
          }
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialService]);

  const eligibleStaff = useMemo(() => {
    if (!options || !service) return [];
    return options.staff.filter(
      (s) => !s.specialties.length || s.specialties.includes(service)
    );
  }, [options, service]);

  const selectedStaff = options?.staff.find((s) => s.id === staffId) || null;
  const selectedService =
    options?.services.find((s) => s.key === service) || null;

  const dateOptions = useMemo(() => {
    const lead = options?.bookingLeadDays || 45;
    const days: string[] = [];
    for (let i = 0; i < Math.min(lead, 60); i++) {
      days.push(format(addDays(new Date(), i), "yyyy-MM-dd"));
    }
    return days;
  }, [options?.bookingLeadDays]);

  useEffect(() => {
    if (!staffId || !date) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSlotsLoading(true);
      setStartTime("");
      setSlots([]);
      void (async () => {
        try {
          const params = new URLSearchParams({ staffId, date });
          if (service) params.set("service", service);
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
  }, [staffId, date, service]);

  function canContinue(): boolean {
    if (step === 0) return Boolean(service);
    if (step === 1) return Boolean(staffId);
    if (step === 2) return Boolean(date);
    if (step === 3) return Boolean(startTime);
    return true;
  }

  function next() {
    setError("");
    if (!canContinue()) {
      setError(t("book.required"));
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_KEYS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!service || !staffId || !date || !startTime) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          staffId,
          date,
          startTime,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("book.errorSubmit"));
      }
      setResult(data.appointment as AppointmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("book.errorSubmit"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setResult(null);
    setStep(0);
    setService(null);
    setStaffId(null);
    setDate("");
    setStartTime("");
    setSlots([]);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setError("");
  }

  if (loadError) {
    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white p-8 text-center shadow-[var(--shadow-soft)] md:p-10">
        <p className="text-[var(--danger)]">{t("book.errorLoad")}</p>
        <button
          type="button"
          className="btn btn-ghost mt-4"
          onClick={() => window.location.reload()}
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white p-10 text-center text-[var(--slate)] shadow-[var(--shadow-soft)]">
        {t("book.loading")}
      </div>
    );
  }

  if (result) {
    const resultServiceTitle = translateServiceField(
      result.service,
      "title",
      result.service
    );

    return (
      <motion.div
        className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden bg-[var(--ink)] px-5 py-8 text-white sm:px-8 sm:py-10 md:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at 20% 0%, rgba(158,201,230,0.35), transparent 55%)",
            }}
          />
          <div className="relative">
            <span className="eyebrow !text-[#9ec9e6]">{t("book.eyebrow")}</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(1.85rem,6vw,3rem)] text-white md:text-5xl">
              {t("book.successTitle")}
            </h2>
            <p className="mt-3 max-w-lg text-white/70">{t("book.successLead")}</p>
          </div>
        </div>
        <div className="grid gap-6 px-5 py-7 sm:px-8 sm:py-8 md:grid-cols-2 md:px-12">
          <div className="space-y-4 text-[var(--ink-soft)]">
            <p>
              <strong className="text-[var(--ink)]">
                {t("book.steps.service")}:
              </strong>{" "}
              {resultServiceTitle}
            </p>
            <p>
              <strong className="text-[var(--ink)]">{t("book.specialist")}:</strong>{" "}
              {result.staffName || selectedStaff?.name}
            </p>
            <p>
              <strong className="text-[var(--ink)]">{t("book.when")}:</strong>{" "}
              {formatDate(result.date)} · {result.startTime}
            </p>
            <p>
              <strong className="text-[var(--ink)]">{t("book.fields.name")}:</strong>{" "}
              {result.customerName}
            </p>
          </div>
          <div className="rounded-[1.1rem] border border-[var(--line)] bg-[var(--mist)] p-5 sm:p-6">
            <p className="text-sm text-[var(--slate)]">{t("book.manageBooking")}</p>
            <Link
              href={`/appointments/manage?token=${encodeURIComponent(result.manageToken)}`}
              className="mt-3 inline-block min-h-11 font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              {t("book.manageBooking")}
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-[var(--line)] px-5 py-5 sm:flex-row sm:flex-wrap sm:px-8 sm:py-6 md:px-12">
          <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={resetWizard}>
            {t("book.bookAnother")}
          </button>
          <Link href="/" className="btn btn-ghost w-full sm:w-auto">
            {t("common.backHome")}
          </Link>
        </div>
      </motion.div>
    );
  }

  const serviceTitle = selectedService
    ? translateServiceField(
        selectedService.key,
        "title",
        selectedService.title
      )
    : service;

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)] sm:rounded-[1.5rem]">
      <div className="border-b border-[var(--line)] px-3 py-4 sm:px-5 sm:py-6 md:px-10">
        <ol className="flex items-start justify-between gap-0.5 sm:gap-1">
          {STEP_KEYS.map((key, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={key} className="relative flex min-w-0 flex-1 flex-col items-center">
                {i < STEP_KEYS.length - 1 && (
                  <span
                    className={`absolute start-1/2 top-4 h-px w-full ${
                      done ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]"
                    }`}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => i < step && setStep(i)}
                  className="relative z-[1] flex min-h-11 flex-col items-center gap-1.5 sm:gap-2"
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                      active
                        ? "bg-[var(--ink)] text-white shadow-[var(--shadow-soft)]"
                        : done
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--mist)] text-[var(--slate)]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`max-w-full truncate px-0.5 text-center text-[0.58rem] font-semibold uppercase tracking-[0.06em] sm:text-[0.68rem] sm:tracking-[0.12em] ${
                      active
                        ? "text-[var(--ink)]"
                        : done
                          ? "text-[var(--accent)]"
                          : "text-[var(--slate)]"
                    }`}
                  >
                    {t(`book.steps.${key}`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="px-4 py-6 sm:px-5 sm:py-8 md:px-10 md:py-10">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="service" {...stepMotion}>
              <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.65rem,5vw,2.5rem)] md:text-4xl">
                {t("book.chooseService")}
              </h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {options.services.map((s) => {
                  const active = service === s.key;
                  const title = translateServiceField(s.key, "title", s.title);
                  const description = translateServiceField(
                    s.key,
                    "description",
                    s.description
                  );
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setService(s.key);
                        setStaffId(null);
                        setDate("");
                        setStartTime("");
                      }}
                      className={`group overflow-hidden rounded-[1.25rem] border text-left transition duration-300 ${
                        active
                          ? "border-[var(--accent)] shadow-[var(--shadow)] ring-2 ring-[var(--accent-wash)]"
                          : "border-[var(--line)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-soft)]"
                      }`}
                    >
                      <div className="relative aspect-[16/10]">
                        <Image
                          src={s.image}
                          alt=""
                          fill
                          className="object-cover transition duration-700 group-hover:scale-[1.04]"
                          sizes="(max-width: 768px) 100vw, 360px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                      </div>
                      <div className="p-5">
                        <div className="font-[family-name:var(--font-display)] text-2xl">
                          {title}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--slate)]">
                          {description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="doctor" {...stepMotion}>
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
                {t("book.chooseDoctor")}
              </h2>
              {eligibleStaff.length === 0 ? (
                <p className="mt-8 text-[var(--slate)]">{t("book.noSlots")}</p>
              ) : (
                <div className="mt-8 grid gap-4">
                  {eligibleStaff.map((s) => {
                    const active = staffId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setStaffId(s.id);
                          setDate("");
                          setStartTime("");
                        }}
                        className={`flex items-start gap-3 rounded-[1.25rem] border p-4 text-left transition duration-300 sm:gap-5 sm:p-5 md:p-6 ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-wash)] shadow-[var(--shadow-soft)]"
                            : "border-[var(--line)] hover:border-[var(--accent)] hover:shadow-[var(--shadow-soft)]"
                        }`}
                      >
                        {s.image ? (
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--mist)] sm:h-16 sm:w-16">
                            <Image
                              src={s.image}
                              alt=""
                              fill
                              className="object-cover object-[center_20%]"
                              sizes="64px"
                            />
                          </span>
                        ) : (
                          <span
                            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold text-white sm:h-16 sm:w-16"
                            style={{ background: s.color }}
                          >
                            {s.name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-[family-name:var(--font-display)] text-2xl">
                            {s.name}
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-[var(--accent)]">
                            {s.title}
                          </span>
                          {s.bio && (
                            <span className="mt-2 block text-sm leading-relaxed text-[var(--slate)]">
                              {s.bio}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="date" {...stepMotion}>
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
                {t("book.chooseDate")}
              </h2>
              <div className="mt-8 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                {dateOptions.map((d) => {
                  const active = date === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDate(d)}
                      className={`rounded-[1rem] border px-3 py-3.5 text-left text-sm transition ${
                        active
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white shadow-[var(--shadow-soft)]"
                          : "border-[var(--line)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <span className="block font-semibold">{formatDate(d)}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="time" {...stepMotion}>
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
                {t("book.chooseTime")}
              </h2>
              {slotsLoading ? (
                <p className="mt-8 text-[var(--slate)]">{t("common.loading")}</p>
              ) : slots.length === 0 ? (
                <p className="mt-8 text-[var(--slate)]">{t("book.noSlots")}</p>
              ) : (
                <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((slot) => {
                    const active = startTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setStartTime(slot)}
                        className={`min-h-12 rounded-xl border py-3.5 text-sm font-semibold transition ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[var(--shadow-soft)]"
                            : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.form key="details" {...stepMotion} onSubmit={onSubmit}>
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
                {t("book.yourDetails")}
              </h2>
              <p className="mt-2 text-[var(--slate)]">
                {serviceTitle} · {selectedStaff?.name} · {formatDate(date)} ·{" "}
                {startTime}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label>
                  <span className="label">{t("book.fields.name")}</span>
                  <input
                    className="input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span className="label">{t("book.fields.phone")}</span>
                  <input
                    className="input"
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="label">{t("book.fields.email")}</span>
                  <input
                    className="input"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="md:col-span-2">
                  <span className="label">{t("book.fields.notes")}</span>
                  <textarea
                    className="textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>

              {error && (
                <p className="mt-4 text-sm font-medium text-[var(--danger)]">
                  {error}
                </p>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={back}>
                  {t("book.back")}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary w-full sm:w-auto"
                  disabled={submitting}
                >
                  {submitting ? t("book.submitting") : t("book.confirm")}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {step < 4 && (
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-5 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pt-6">
            <button
              type="button"
              className="btn btn-ghost w-full sm:w-auto"
              onClick={back}
              disabled={step === 0}
            >
              {t("book.back")}
            </button>
            {error && (
              <p className="order-first w-full text-sm font-medium text-[var(--danger)] sm:order-none sm:w-auto">
                {error}
              </p>
            )}
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={next}>
              {t("book.continue")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
