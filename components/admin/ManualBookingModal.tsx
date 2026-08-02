"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
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

function daySupports(day: { services?: ClinicAppointmentType[] }, type: ClinicAppointmentType) {
  const services = day.services || [];
  if (!services.length) return true;
  return services.includes(type);
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

type Step = "service" | "schedule" | "details" | "review";

const STEPS: Step[] = ["service", "schedule", "details", "review"];

export default function ManualBookingModal({ open, onClose, onCreated }: Props) {
  const { t, locale } = useLocale();
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<ClinicAppointmentType>("eye_exam");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedBooked, setSelectedBooked] = useState<SlotRow | null>(null);

  const reset = useCallback(() => {
    setStep("service");
    setService("eye_exam");
    setDate("");
    setTime("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setError("");
    setSelectedBooked(null);
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
      setError(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const selectedDay = useMemo(
    () => serviceDays.find((d) => d.date === date) || null,
    [serviceDays, date],
  );

  useEffect(() => {
    if (!date) return;
    if (!serviceDays.some((d) => d.date === date)) {
      setDate("");
      setTime("");
    }
  }, [service, serviceDays, date]);

  useEffect(() => {
    setTime("");
    setSelectedBooked(null);
  }, [date]);

  const serviceLabel = (type: ClinicAppointmentType) =>
    t(`clinicBooking.services.${type}`);

  const stepIndex = STEPS.indexOf(step);

  function canContinue(): boolean {
    if (step === "service") return Boolean(service);
    if (step === "schedule") return Boolean(date && time);
    if (step === "details") {
      return Boolean(firstName.trim() && lastName.trim() && phone.trim() && email.trim());
    }
    return true;
  }

  function goNext() {
    if (!canContinue()) return;
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function confirmBooking(e?: FormEvent) {
    e?.preventDefault();
    if (!date || !time) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/eye-exam/book", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim(),
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
            : "Booking failed";
      const conflict =
        /conflict|unavailable|already|taken|booked/i.test(message) ||
        (err instanceof ApiError && err.status === 409);
      setError(
        conflict
          ? "That time was just taken. The schedule has been refreshed — please pick another slot."
          : message,
      );
      await loadSchedule();
      if (conflict) {
        setTime("");
        setStep("schedule");
      }
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
        className="admin-card flex max-h-[94svh] w-full max-w-5xl flex-col overflow-hidden rounded-b-none sm:rounded-[18px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Manual booking"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <p className="admin-kicker">Manual booking</p>
            <h2 className="admin-section-title mt-1">New appointment</h2>
            <p className="admin-page-desc mt-1">
              Choose a service, pick an open slot, then confirm customer details.
            </p>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile step indicator */}
        <div className="mt-4 flex gap-2 lg:hidden">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= stepIndex ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,0.08)]",
              )}
            />
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {/* Desktop two-column from schedule onward; mobile steps */}
          <div className="hidden gap-5 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div>
                <p className="admin-card-label mb-2">Service</p>
                <div className="space-y-2">
                  {SERVICES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setService(type)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-start text-sm font-semibold transition",
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
                <p className="admin-card-label mb-2">Date</p>
                <div className="max-h-[320px] space-y-1.5 overflow-y-auto pe-1">
                  {loading ? (
                    <p className="admin-muted text-sm">Loading dates…</p>
                  ) : serviceDays.length === 0 ? (
                    <p className="admin-muted text-sm">
                      No open dates for this service.
                    </p>
                  ) : (
                    serviceDays.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDate(d.date)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-start text-sm transition",
                          date === d.date
                            ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
                            : "border-[var(--line)] hover:border-[var(--accent)]",
                        )}
                      >
                        <span className="block font-semibold">{d.label}</span>
                        <span className="admin-muted text-xs">{d.date}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>

            <div className="space-y-5">
              <ScheduleGrid
                day={selectedDay}
                selectedTime={time}
                onSelectAvailable={(slotTime) => {
                  setTime(slotTime);
                  setSelectedBooked(null);
                }}
                onInspectBooked={(slot) => setSelectedBooked(slot)}
              />

              <CustomerFields
                firstName={firstName}
                lastName={lastName}
                phone={phone}
                email={email}
                notes={notes}
                onChange={{
                  firstName: setFirstName,
                  lastName: setLastName,
                  phone: setPhone,
                  email: setEmail,
                  notes: setNotes,
                }}
              />

              <SummaryCard
                service={serviceLabel(service)}
                dateLabel={selectedDay?.label || date || "—"}
                time={time || "—"}
                customer={`${firstName} ${lastName}`.trim() || "—"}
              />
            </div>
          </div>

          {/* Mobile stepped flow */}
          <div className="space-y-4 lg:hidden">
            {step === "service" ? (
              <div className="space-y-2">
                <p className="admin-card-label">1 · Service</p>
                {SERVICES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setService(type)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-start text-sm font-semibold",
                      service === type
                        ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
                        : "border-[var(--line)]",
                    )}
                  >
                    {serviceLabel(type)}
                  </button>
                ))}
              </div>
            ) : null}

            {step === "schedule" ? (
              <div className="space-y-4">
                <div>
                  <p className="admin-card-label mb-2">2 · Date</p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {serviceDays.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDate(d.date)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-start text-sm",
                          date === d.date
                            ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
                            : "border-[var(--line)]",
                        )}
                      >
                        <span className="font-semibold">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <ScheduleGrid
                  day={selectedDay}
                  selectedTime={time}
                  onSelectAvailable={(slotTime) => {
                    setTime(slotTime);
                    setSelectedBooked(null);
                  }}
                  onInspectBooked={(slot) => setSelectedBooked(slot)}
                />
              </div>
            ) : null}

            {step === "details" ? (
              <div>
                <p className="admin-card-label mb-2">3 · Customer</p>
                <CustomerFields
                  firstName={firstName}
                  lastName={lastName}
                  phone={phone}
                  email={email}
                  notes={notes}
                  onChange={{
                    firstName: setFirstName,
                    lastName: setLastName,
                    phone: setPhone,
                    email: setEmail,
                    notes: setNotes,
                  }}
                />
              </div>
            ) : null}

            {step === "review" ? (
              <div className="space-y-3">
                <p className="admin-card-label">4 · Review</p>
                <SummaryCard
                  service={serviceLabel(service)}
                  dateLabel={selectedDay?.label || date || "—"}
                  time={time || "—"}
                  customer={`${firstName} ${lastName}`.trim() || "—"}
                  phone={phone}
                  email={email}
                  notes={notes}
                />
              </div>
            ) : null}
          </div>
        </div>

        {selectedBooked ? (
          <div className="mt-4 rounded-xl border border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.1)] px-4 py-3 text-sm">
            <p className="font-semibold text-[var(--danger)]">
              {selectedBooked.time} — Booked
            </p>
            <p className="mt-1 text-[var(--ink)]">
              {selectedBooked.bookedBy || "Customer booking"}
            </p>
            <p className="admin-muted mt-1">
              This slot cannot be selected. Choose an available time.
            </p>
            <button
              type="button"
              className="btn btn-ghost mt-2 !min-h-9 !px-3 !text-xs"
              onClick={() => setSelectedBooked(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>

          <div className="flex flex-wrap gap-2">
            {/* Mobile nav */}
            <div className="flex gap-2 lg:hidden">
              {stepIndex > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={goBack}>
                  <ArrowLeft size={16} /> Back
                </button>
              ) : null}
              {step !== "review" ? (
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={!canContinue()}
                  onClick={goNext}
                >
                  Continue <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={saving || !canContinue()}
                  onClick={() => void confirmBooking()}
                >
                  <Check size={16} />
                  {saving ? "Confirming…" : "Confirm booking"}
                </button>
              )}
            </div>

            {/* Desktop confirm */}
            <button
              type="button"
              className="btn btn-accent hidden lg:inline-flex"
              disabled={
                saving ||
                !date ||
                !time ||
                !firstName.trim() ||
                !lastName.trim() ||
                !phone.trim() ||
                !email.trim()
              }
              onClick={() => void confirmBooking()}
            >
              <Check size={16} />
              {saving ? "Confirming…" : "Confirm booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleGrid({
  day,
  selectedTime,
  onSelectAvailable,
  onInspectBooked,
}: {
  day: DayRow | null;
  selectedTime: string;
  onSelectAvailable: (time: string) => void;
  onInspectBooked: (slot: SlotRow) => void;
}) {
  if (!day) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-10 text-center">
        <p className="admin-muted text-sm">Select a date to view the daily schedule.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="admin-card-label">Time slots</p>
          <p className="admin-section-title mt-1 text-base">{day.label}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-[rgba(94,196,154,0.16)] px-2 py-1 text-[#5EC49A]">
            Available
          </span>
          <span className="rounded-full bg-[rgba(224,122,122,0.16)] px-2 py-1 text-[#E07A7A]">
            Booked
          </span>
          <span className="rounded-full bg-[rgba(119,129,138,0.2)] px-2 py-1 text-[#A7ADB5]">
            Closed
          </span>
          <span className="rounded-full bg-[rgba(212,175,106,0.18)] px-2 py-1 text-[#D4AF6A]">
            Selected
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {day.slots.map((slot) => {
          const selected = selectedTime === slot.time && !slot.isBooked && slot.isEnabled;
          const booked = Boolean(slot.isBooked);
          const disabled = !slot.isEnabled && !booked;
          return (
            <button
              key={slot.id}
              type="button"
              title={
                booked
                  ? `${slot.time} — Booked${slot.bookedBy ? ` · ${slot.bookedBy}` : ""}`
                  : disabled
                    ? `${slot.time} — Closed`
                    : `${slot.time} — Available`
              }
              onClick={() => {
                if (booked) onInspectBooked(slot);
                else if (slot.isEnabled) onSelectAvailable(slot.time);
              }}
              disabled={disabled}
              className={cn(
                "rounded-xl border px-3 py-3 text-start text-sm transition",
                selected &&
                  "border-[#D4AF6A] bg-[rgba(212,175,106,0.2)] text-[#D4AF6A] ring-1 ring-[#D4AF6A]",
                !selected &&
                  booked &&
                  "border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] text-[#E07A7A]",
                !selected &&
                  !booked &&
                  slot.isEnabled &&
                  "border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.1)] text-[#5EC49A] hover:border-[#5EC49A]",
                disabled &&
                  "cursor-not-allowed border-[var(--line)] bg-[rgba(255,255,255,0.03)] text-[#77818A] opacity-70",
              )}
            >
              <strong className="block text-base font-bold">{slot.time}</strong>
              <span className="mt-0.5 block text-[0.7rem] font-semibold uppercase tracking-wide">
                {booked ? "Booked" : disabled ? "Closed" : selected ? "Selected" : "Available"}
              </span>
              {booked && slot.bookedBy ? (
                <span className="mt-1 block truncate text-xs font-medium opacity-90">
                  {slot.bookedBy}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomerFields({
  firstName,
  lastName,
  phone,
  email,
  notes,
  onChange,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  onChange: {
    firstName: (v: string) => void;
    lastName: (v: string) => void;
    phone: (v: string) => void;
    email: (v: string) => void;
    notes: (v: string) => void;
  };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">First name</label>
        <input
          className="input"
          value={firstName}
          onChange={(e) => onChange.firstName(e.target.value)}
          placeholder="First name"
          required
        />
      </div>
      <div>
        <label className="label">Last name</label>
        <input
          className="input"
          value={lastName}
          onChange={(e) => onChange.lastName(e.target.value)}
          placeholder="Last name"
          required
        />
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => onChange.phone(e.target.value)}
          placeholder="05X-XXX-XXXX"
          required
        />
      </div>
      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => onChange.email(e.target.value)}
          placeholder="customer@email.com"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Internal note (optional)</label>
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => onChange.notes(e.target.value)}
          placeholder="Private note for staff only"
          rows={3}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  service,
  dateLabel,
  time,
  customer,
  phone,
  email,
  notes,
}: {
  service: string;
  dateLabel: string;
  time: string;
  customer: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--admin-elevated)] p-4">
      <p className="admin-card-label">Booking summary</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="admin-muted">Service</dt>
          <dd className="font-semibold text-[var(--ink)]">{service}</dd>
        </div>
        <div>
          <dt className="admin-muted">Date</dt>
          <dd className="font-semibold text-[var(--ink)]">{dateLabel}</dd>
        </div>
        <div>
          <dt className="admin-muted">Time</dt>
          <dd className="font-semibold text-[var(--accent)]">{time}</dd>
        </div>
        <div>
          <dt className="admin-muted">Customer</dt>
          <dd className="font-semibold text-[var(--ink)]">{customer}</dd>
        </div>
        {phone ? (
          <div>
            <dt className="admin-muted">Phone</dt>
            <dd className="text-[var(--ink)]">{phone}</dd>
          </div>
        ) : null}
        {email ? (
          <div>
            <dt className="admin-muted">Email</dt>
            <dd className="text-[var(--ink)]">{email}</dd>
          </div>
        ) : null}
        {notes ? (
          <div className="sm:col-span-2">
            <dt className="admin-muted">Note</dt>
            <dd className="text-[var(--ink)]">{notes}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
