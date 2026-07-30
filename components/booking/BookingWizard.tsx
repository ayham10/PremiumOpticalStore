"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { addDays, format } from "date-fns";
import type { ServiceType } from "@/lib/types";
import { formatDate } from "@/lib/format";

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

const STEPS = ["Service", "Specialist", "Date", "Time", "Details"] as const;

export default function BookingWizard({
  initialService,
}: {
  initialService?: string | null;
}) {
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [loadError, setLoadError] = useState("");
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
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Unable to load booking"
          );
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
      setError("Please complete this step to continue.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
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
        throw new Error(data.error || "Booking failed");
      }
      setResult(data.appointment as AppointmentResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-[var(--danger)]">{loadError}</p>
        <button
          type="button"
          className="btn btn-ghost mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!options) {
    return (
      <div className="surface p-10 text-center text-[var(--slate)]">
        Loading booking options…
      </div>
    );
  }

  if (result) {
    return (
      <div className="surface overflow-hidden">
        <div className="bg-[var(--ink)] px-8 py-10 text-white md:px-12">
          <span className="eyebrow !text-[#9ec9e6]">Confirmed request</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-white">
            You&apos;re nearly there
          </h2>
          <p className="mt-3 max-w-lg text-white/70">
            Your appointment request is {result.status}. We&apos;ll confirm shortly
            — save your manage link to reschedule or cancel anytime.
          </p>
        </div>
        <div className="grid gap-6 px-8 py-8 md:grid-cols-2 md:px-12">
          <div className="space-y-3 text-[var(--ink-soft)]">
            <p>
              <strong className="text-[var(--ink)]">Service:</strong>{" "}
              {result.service}
            </p>
            <p>
              <strong className="text-[var(--ink)]">Specialist:</strong>{" "}
              {result.staffName || selectedStaff?.name}
            </p>
            <p>
              <strong className="text-[var(--ink)]">When:</strong>{" "}
              {formatDate(result.date)} at {result.startTime}
            </p>
            <p>
              <strong className="text-[var(--ink)]">Name:</strong>{" "}
              {result.customerName}
            </p>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--mist)] p-5">
            <p className="text-sm text-[var(--slate)]">Manage your appointment</p>
            <Link
              href={`/appointments/manage?token=${encodeURIComponent(result.manageToken)}`}
              className="mt-2 inline-block font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              Open manage page
            </Link>
            <p className="mt-3 break-all text-xs text-[var(--slate)]">
              Token: {result.manageToken}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-[var(--line)] px-8 py-6 md:px-12">
          <Link href="/" className="btn btn-primary">
            Back home
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            Browse glasses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {/* Stepper */}
      <div className="border-b border-[var(--line)] px-6 py-5 md:px-10">
        <ol className="flex flex-wrap gap-2 md:gap-3">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={i > step}
                onClick={() => i < step && setStep(i)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                  i === step
                    ? "bg-[var(--ink)] text-white"
                    : i < step
                      ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                      : "bg-[var(--mist)] text-[var(--slate)]"
                }`}
              >
                <span className="opacity-70">{i + 1}</span>
                {label}
              </button>
              {i < STEPS.length - 1 && (
                <span className="hidden text-[var(--line-strong)] sm:inline">—</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="px-6 py-8 md:px-10 md:py-10">
        {/* Step 1: Service */}
        {step === 0 && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Choose a service
            </h2>
            <p className="mt-2 text-[var(--slate)]">
              Select the care you need — we&apos;ll match the right specialist.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {options.services.map((s) => {
                const active = service === s.key;
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
                    className={`group overflow-hidden rounded-[var(--radius-sm)] border text-left transition ${
                      active
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent-wash)]"
                        : "border-[var(--line)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <div className="relative aspect-[16/9]">
                      <Image
                        src={s.image}
                        alt=""
                        fill
                        className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        sizes="320px"
                      />
                    </div>
                    <div className="p-4">
                      <div className="font-[family-name:var(--font-display)] text-xl">
                        {s.title}
                      </div>
                      <p className="mt-1 text-sm text-[var(--slate)]">
                        {s.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Staff */}
        {step === 1 && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Choose your specialist
            </h2>
            <p className="mt-2 text-[var(--slate)]">
              Available for {selectedService?.title || service}.
            </p>
            {eligibleStaff.length === 0 ? (
              <p className="mt-8 text-[var(--slate)]">
                No specialists available for this service right now.
              </p>
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
                      className={`flex items-start gap-4 rounded-[var(--radius-sm)] border p-5 text-left transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-wash)]"
                          : "border-[var(--line)] hover:border-[var(--accent)]"
                      }`}
                    >
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span>
                        <span className="block font-[family-name:var(--font-display)] text-xl">
                          {s.name}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-[var(--accent)]">
                          {s.title}
                        </span>
                        {s.bio && (
                          <span className="mt-2 block text-sm text-[var(--slate)]">
                            {s.bio}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Date */}
        {step === 2 && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Pick a date
            </h2>
            <p className="mt-2 text-[var(--slate)]">
              With {selectedStaff?.name}. Slots refresh based on availability.
            </p>
            <div className="mt-8 grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {dateOptions.map((d) => {
                const active = date === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    className={`rounded-[var(--radius-sm)] border px-3 py-3 text-left text-sm transition ${
                      active
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] hover:border-[var(--accent)]"
                    }`}
                  >
                    <span className="block font-semibold">{formatDate(d)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Time */}
        {step === 3 && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Select a time
            </h2>
            <p className="mt-2 text-[var(--slate)]">
              {formatDate(date)} · {options.appointmentSlotMinutes}-minute slots
            </p>
            {slotsLoading ? (
              <p className="mt-8 text-[var(--slate)]">Loading available times…</p>
            ) : slots.length === 0 ? (
              <p className="mt-8 text-[var(--slate)]">
                No open slots on this day. Please choose another date.
              </p>
            ) : (
              <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {slots.map((t) => {
                  const active = startTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStartTime(t)}
                      className={`rounded-full border py-3 text-sm font-semibold transition ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Details */}
        {step === 4 && (
          <form onSubmit={onSubmit}>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">
              Your details
            </h2>
            <p className="mt-2 text-[var(--slate)]">
              {selectedService?.title} with {selectedStaff?.name} on{" "}
              {formatDate(date)} at {startTime}
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">Full name</span>
                <input
                  className="input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                <span className="label">Phone</span>
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
                <span className="label">Email</span>
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
                <span className="label">Notes (optional)</span>
                <textarea
                  className="textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lens preferences, previous prescription, accessibility needs…"
                />
              </label>
            </div>

            {error && (
              <p className="mt-4 text-sm font-medium text-[var(--danger)]">{error}</p>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" className="btn btn-ghost" onClick={back}>
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </form>
        )}

        {step < 4 && (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-6">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={back}
              disabled={step === 0}
            >
              Back
            </button>
            {error && (
              <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
            )}
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
