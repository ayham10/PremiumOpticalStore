"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
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

/** Backend still expects email; UI no longer collects it. */
function syntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "") || "guest";
  return `booking.${digits}@oyon.guest`;
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
  const { t, locale } = useLocale();
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

  const reset = useCallback(() => {
    setService("eye_exam");
    setDate("");
    setTime("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setNotes("");
    setError("");
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
      setError(err instanceof Error ? err.message : t("admin.bookings.loadError"));
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

  const selectedDay = useMemo(
    () => serviceDays.find((d) => d.date === date) || null,
    [serviceDays, date],
  );

  const availableSlots = useMemo(() => {
    if (!selectedDay) return [];
    return selectedDay.slots.filter((s) => s.isEnabled && !s.isBooked);
  }, [selectedDay]);

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
      setError(
        conflict ? t("admin.bookings.conflictError") : message,
      );
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
              <p className="admin-card-label mb-2">{t("admin.bookings.service")}</p>
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
              <div className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
                {loading ? (
                  <p className="admin-muted text-sm">
                    {t("admin.bookings.loadingDates")}
                  </p>
                ) : serviceDays.length === 0 ? (
                  <p className="admin-muted text-sm">
                    {t("admin.bookings.noDates")}
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
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {availableSlots.map((slot) => {
                    const selected = time === slot.time;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setTime(slot.time)}
                        className={cn(
                          "rounded-xl border px-2 py-3 text-center text-sm font-bold transition",
                          selected
                            ? "border-[#D4AF6A] bg-[rgba(212,175,106,0.2)] text-[#D4AF6A] ring-1 ring-[#D4AF6A]"
                            : "border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.1)] text-[#5EC49A] hover:border-[#5EC49A]",
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
