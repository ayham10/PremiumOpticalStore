"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Info,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/lib/format";
import type { ClinicAppointmentType } from "@/lib/types";

export type AvailabilitySlot = {
  id: string;
  time: string;
  isEnabled: boolean;
  isBooked?: boolean;
  bookedBy?: string;
  bookedId?: string;
};

export type AvailabilityDay = {
  id: string;
  date: string;
  label: string;
  isOpen: boolean;
  slots: AvailabilitySlot[];
  services?: ClinicAppointmentType[];
};

const ALL_SERVICES: ClinicAppointmentType[] = [
  "eye_exam",
  "contact_lens_fitting",
  "frame_consultation",
  "sunglasses_consultation",
];

type Props = {
  days: AvailabilityDay[];
  defaultTimes: string[];
  busy?: boolean;
  onSelectDayId?: (id: string) => void;
  selectedId?: string;
  onPatchDay: (body: Record<string, unknown>) => Promise<void>;
  onCreateDay: (payload: {
    date: string;
    services: ClinicAppointmentType[];
    copyFromDate?: string;
  }) => Promise<void>;
  onDeleteDay: (id: string) => Promise<void>;
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function AvailabilityCalendarPanel({
  days,
  defaultTimes,
  busy,
  selectedId,
  onSelectDayId,
  onPatchDay,
  onCreateDay,
  onDeleteDay,
}: Props) {
  const { t, locale } = useLocale();
  const dateLocale = locale === "ar" ? ar : locale === "he" ? he : enUS;

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [addTimeOpen, setAddTimeOpen] = useState(false);
  const [newTime, setNewTime] = useState("09:00");
  const [activeSlotTime, setActiveSlotTime] = useState<string | null>(null);
  const [bookedSlot, setBookedSlot] = useState<AvailabilitySlot | null>(null);

  const [addDate, setAddDate] = useState("");
  const [addCopyFrom, setAddCopyFrom] = useState("");
  const [addServices, setAddServices] = useState<ClinicAppointmentType[]>([
    ...ALL_SERVICES,
  ]);
  const [copyFromDate, setCopyFromDate] = useState("");

  const dayByDate = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const selected = useMemo(() => {
    if (selectedId) {
      const byId = days.find((d) => d.id === selectedId);
      if (byId) return byId;
    }
    if (pickedDate) return dayByDate.get(pickedDate) || null;
    return null;
  }, [days, selectedId, pickedDate, dayByDate]);

  useEffect(() => {
    if (selected) {
      setPickedDate(selected.date);
      setMonthCursor(parseYmd(selected.date));
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveSlotTime(null);
  }, [selected?.id]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const activeServices = useMemo(() => {
    if (!selected) return [...ALL_SERVICES];
    if (!selected.services || selected.services.length === 0) {
      return [...ALL_SERVICES];
    }
    return selected.services;
  }, [selected]);

  const isShared =
    !selected?.services ||
    selected.services.length === 0 ||
    ALL_SERVICES.every((s) => activeServices.includes(s));

  function selectCalendarDate(day: Date) {
    const key = ymd(day);
    setPickedDate(key);
    const existing = dayByDate.get(key);
    if (existing) {
      onSelectDayId?.(existing.id);
    } else {
      onSelectDayId?.("");
      setAddDate(key);
      setAddOpen(true);
    }
  }

  function openCopyModal() {
    if (!selected) {
      setAddDate(pickedDate || "");
      setAddOpen(true);
      return;
    }
    setCopyFromDate("");
    setCopyOpen(true);
  }

  function openAddTimeModal() {
    if (!selected) {
      setAddDate(pickedDate || "");
      setAddOpen(true);
      return;
    }
    setNewTime("09:00");
    setAddTimeOpen(true);
  }

  async function handleAddTimeConfirm() {
    if (!selected || !newTime || busy) return;
    const existing = selected.slots.find((s) => s.time === newTime);
    if (existing) {
      await onPatchDay({
        toggleTime: { time: newTime, isEnabled: true },
      });
    } else {
      await onPatchDay({
        slots: [
          ...selected.slots.map((s) => ({
            time: s.time,
            isEnabled: s.isEnabled,
          })),
          { time: newTime, isEnabled: true },
        ],
      });
    }
    setActiveSlotTime(newTime);
    setAddTimeOpen(false);
  }

  async function toggleService(service: ClinicAppointmentType) {
    if (!selected || busy) return;
    const current = activeServices;
    const next = current.includes(service)
      ? current.filter((s) => s !== service)
      : [...current, service];
    if (next.length === 0) return;
    const shared = ALL_SERVICES.every((s) => next.includes(s));
    await onPatchDay({ services: shared ? null : next });
  }

  async function selectAllServices() {
    if (!selected || busy) return;
    await onPatchDay({ services: null });
  }

  async function handleCopyConfirm() {
    if (!selected || !copyFromDate || busy) return;
    const source = dayByDate.get(copyFromDate);
    if (!source) return;
    if (
      !window.confirm(
        t("admin.availability.overwriteConfirm", {
          target: selected.label,
          source: source.label,
        }),
      )
    ) {
      return;
    }
    await onPatchDay({
      isOpen: source.isOpen,
      services:
        !source.services || source.services.length === 0
          ? null
          : source.services,
      slots: source.slots.map((s) => ({
        time: s.time,
        isEnabled: s.isEnabled,
      })),
    });
    setCopyOpen(false);
    setMoreOpen(false);
  }

  async function handleAddConfirm() {
    if (!addDate || addServices.length === 0 || busy) return;
    await onCreateDay({
      date: addDate,
      services: addServices,
      copyFromDate: addCopyFrom || undefined,
    });
    setAddOpen(false);
    setAddDate("");
    setAddCopyFrom("");
    setAddServices([...ALL_SERVICES]);
  }

  function slotStatusLabel(booked: boolean, available: boolean) {
    if (booked) return t("admin.availability.booked");
    if (available) return t("admin.availability.available");
    return t("admin.availability.unavailable");
  }

  function dayDotClass(row: AvailabilityDay | undefined) {
    if (!row) return "is-none";
    if (!row.isOpen) return "is-closed";
    if (row.slots.some((s) => s.isBooked)) return "is-limited";
    return "is-open";
  }

  const weekdayKeys = ["0", "1", "2", "3", "4", "5", "6"] as const;

  return (
    <div className="admin-wh-shell">
      <div className="admin-wh-grid">
        {/* Compact calendar */}
        <section className="admin-wh-calendar">
          <div className="admin-wh-calendar-head">
            <h3 className="admin-wh-calendar-title">
              {t("admin.availability.calendarTitle")}
            </h3>
            <div className="admin-wh-month-nav">
              <button
                type="button"
                className="admin-wh-nav-btn"
                onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                aria-label={t("admin.availability.prevMonth")}
              >
                <ChevronLeft size={16} />
              </button>
              <p className="admin-wh-month-label">
                {format(monthCursor, "MMMM yyyy", { locale: dateLocale })}
              </p>
              <button
                type="button"
                className="admin-wh-nav-btn"
                onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                aria-label={t("admin.availability.nextMonth")}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="admin-wh-weekdays">
            {weekdayKeys.map((d) => (
              <div key={d}>{t(`days.${d}`)}</div>
            ))}
          </div>

          <div className="admin-wh-days">
            {calendarDays.map((day) => {
              const key = ymd(day);
              const row = dayByDate.get(key);
              const inMonth = isSameMonth(day, monthCursor);
              const selectedDay = pickedDate === key || selected?.date === key;
              const dot = dayDotClass(row);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectCalendarDate(day)}
                  className={cn(
                    "admin-wh-day-cell",
                    !inMonth && "is-outside",
                    selectedDay && "is-selected",
                  )}
                >
                  <span className="admin-wh-day-num">{format(day, "d")}</span>
                  <span className={cn("admin-wh-day-dot", dot)} />
                </button>
              );
            })}
          </div>

          <div className="admin-wh-legend">
            <span>
              <i className="admin-wh-day-dot is-open" />
              {t("admin.availability.available")}
            </span>
            <span>
              <i className="admin-wh-day-dot is-limited" />
              {t("admin.availability.legendLimited")}
            </span>
            <span>
              <i className="admin-wh-day-dot is-closed" />
              {t("admin.availability.closed")}
            </span>
            <span>
              <i className="admin-wh-day-dot is-none" />
              {t("admin.availability.unavailable")}
            </span>
          </div>

          <button
            type="button"
            className="admin-wh-copy-footer"
            disabled={busy}
            onClick={openCopyModal}
          >
            <Copy size={15} />
            {t("admin.availability.copyPrevious")}
          </button>
        </section>

        {/* Day / slots panel */}
        <section className="admin-wh-day">
          {!selected ? (
            <div className="admin-wh-empty">
              <CalendarPlus size={28} className="admin-wh-empty-icon" />
              <p className="admin-wh-empty-title">
                {t("admin.availability.noDate")}
              </p>
              <p className="admin-wh-empty-lead">
                {t("admin.availability.noDateLead")}
              </p>
            </div>
          ) : (
            <>
              <div className="admin-wh-day-header">
                <div className="admin-wh-day-heading">
                  <CalendarDays size={22} className="admin-wh-gold-icon" />
                  <h2 className="admin-wh-day-label">{selected.label}</h2>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className="admin-wh-more-btn"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                    aria-label={t("admin.availability.more")}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {moreOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-20 cursor-default"
                        aria-label={t("common.close")}
                        onClick={() => setMoreOpen(false)}
                      />
                      <div className="admin-wh-more-menu">
                        <MenuButton
                          disabled={busy}
                          onClick={() => {
                            setMoreOpen(false);
                            void onPatchDay({
                              slots: defaultTimes.map((time) => ({
                                time,
                                isEnabled: true,
                              })),
                            });
                          }}
                        >
                          {t("admin.availability.enableAll")}
                        </MenuButton>
                        <MenuButton
                          disabled={busy}
                          onClick={() => {
                            setMoreOpen(false);
                            void onPatchDay({
                              slots: selected.slots.map((s) => ({
                                time: s.time,
                                isEnabled: false,
                              })),
                            });
                          }}
                        >
                          {t("admin.availability.disableAll")}
                        </MenuButton>
                        <MenuButton
                          danger
                          disabled={busy}
                          onClick={() => {
                            setMoreOpen(false);
                            void onDeleteDay(selected.id);
                          }}
                        >
                          {t("admin.availability.deleteDate")}
                        </MenuButton>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="admin-wh-actions">
                <button
                  type="button"
                  className="admin-wh-action"
                  disabled={busy}
                  onClick={openCopyModal}
                >
                  <Copy size={15} />
                  {t("admin.availability.copyPrevious")}
                </button>
                <button
                  type="button"
                  className="admin-wh-action"
                  disabled={busy}
                  onClick={openAddTimeModal}
                >
                  <Plus size={15} />
                  {t("admin.availability.addTime")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "admin-wh-action",
                    selected.isOpen && "is-danger",
                  )}
                  disabled={busy}
                  onClick={() =>
                    void onPatchDay({ isOpen: !selected.isOpen })
                  }
                >
                  <Ban size={15} />
                  {selected.isOpen
                    ? t("admin.availability.markClosed")
                    : t("admin.availability.markOpen")}
                </button>
              </div>

              <div
                className={cn(
                  "admin-wh-banner",
                  selected.isOpen ? "is-open" : "is-closed",
                )}
              >
                <strong>
                  {selected.isOpen
                    ? t("admin.availability.dayOpenBanner")
                    : t("admin.availability.dayClosedBanner")}
                </strong>
                <span>
                  {selected.isOpen
                    ? t("admin.availability.dayOpenLead")
                    : t("admin.availability.dayClosedLead")}
                </span>
              </div>

              <div className="admin-wh-services">
                <div className="admin-wh-services-head">
                  <span>{t("admin.availability.services")}</span>
                  <button
                    type="button"
                    disabled={busy || isShared}
                    onClick={() => void selectAllServices()}
                  >
                    {t("admin.availability.selectAllShared")}
                  </button>
                </div>
                <div className="admin-wh-service-chips">
                  {ALL_SERVICES.map((service) => {
                    const active = activeServices.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleService(service)}
                        className={cn(
                          "admin-wh-service-chip",
                          active && "is-active",
                        )}
                      >
                        {t(`clinicBooking.services.${service}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-wh-slots-head">
                <Clock size={16} className="admin-wh-gold-icon" />
                <h3>{t("admin.availability.availableTimes")}</h3>
              </div>

              <div className="admin-wh-slots">
                {selected.slots.map((slot) => {
                  const booked = Boolean(slot.isBooked);
                  const available = slot.isEnabled && !booked;
                  const closed = !slot.isEnabled && !booked;
                  const status = slotStatusLabel(booked, available);
                  const isActive = activeSlotTime === slot.time;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={busy}
                      title={`${slot.time} — ${status}${
                        booked && slot.bookedBy ? ` · ${slot.bookedBy}` : ""
                      }`}
                      onClick={() => {
                        setActiveSlotTime(slot.time);
                        if (booked) {
                          setBookedSlot(slot);
                          return;
                        }
                        void onPatchDay({
                          toggleTime: {
                            time: slot.time,
                            isEnabled: !slot.isEnabled,
                          },
                        });
                      }}
                      className={cn(
                        "admin-wh-slot",
                        available && "is-available",
                        booked && "is-booked",
                        closed && "is-closed",
                        isActive && "is-active",
                      )}
                    >
                      {isActive ? (
                        <span className="admin-wh-slot-check">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      ) : null}
                      <strong className="admin-wh-slot-time">{slot.time}</strong>
                      <span className="admin-wh-slot-status">
                        <i
                          className={cn(
                            "admin-wh-slot-dot",
                            available && "is-available",
                            booked && "is-booked",
                            closed && "is-closed",
                          )}
                        />
                        {status}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="admin-wh-slot-add"
                  disabled={busy}
                  onClick={openAddTimeModal}
                >
                  <Plus size={16} />
                  {t("admin.availability.addNew")}
                </button>
              </div>

              <p className="admin-wh-tip">
                <Info size={14} />
                {t("admin.availability.slotTip")}
              </p>
            </>
          )}
        </section>
      </div>

      {/* Booked slot details */}
      {bookedSlot ? (
        <ModalShell
          title={t("admin.availability.bookedSlotTitle")}
          onClose={() => setBookedSlot(null)}
          closeLabel={t("common.close")}
        >
          <p className="admin-section-title">{bookedSlot.time}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--danger)]">
            {t("admin.availability.booked")}
          </p>
          <p className="mt-2 text-[var(--ink)]">
            {bookedSlot.bookedBy || t("admin.availability.customerBooking")}
          </p>
          <p className="admin-muted mt-2 text-sm">
            {t("admin.availability.bookedSlotHint")}
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setBookedSlot(null)}
            >
              {t("admin.availability.gotIt")}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {/* Add time modal */}
      {addTimeOpen && selected ? (
        <ModalShell
          title={t("admin.availability.addTime")}
          onClose={() => setAddTimeOpen(false)}
          closeLabel={t("common.close")}
        >
          <div className="space-y-3">
            <div>
              <label className="label">{t("admin.availability.timeLabel")}</label>
              <input
                type="time"
                className="input"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAddTimeOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                disabled={busy || !newTime}
                onClick={() => void handleAddTimeConfirm()}
              >
                {t("admin.availability.confirm")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {/* Add date modal */}
      {addOpen ? (
        <ModalShell
          title={t("admin.availability.addDate")}
          onClose={() => setAddOpen(false)}
          closeLabel={t("common.close")}
        >
          <div className="space-y-3">
            <div>
              <label className="label">{t("common.date")}</label>
              <input
                type="date"
                className="input"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                {t("admin.availability.copyFromOptional")}
              </label>
              <select
                className="select"
                value={addCopyFrom}
                onChange={(e) => setAddCopyFrom(e.target.value)}
              >
                <option value="">{t("admin.availability.defaultSlots")}</option>
                {days.map((d) => (
                  <option key={d.id} value={d.date}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="label">{t("admin.availability.services")}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_SERVICES.map((service) => {
                  const active = addServices.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() =>
                        setAddServices((prev) =>
                          active
                            ? prev.filter((s) => s !== service)
                            : [...prev, service],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]"
                          : "border-[var(--line)] text-[var(--slate)]",
                      )}
                    >
                      {t(`clinicBooking.services.${service}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAddOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                disabled={busy || !addDate || addServices.length === 0}
                onClick={() => void handleAddConfirm()}
              >
                {t("admin.availability.confirm")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {/* Copy schedule modal */}
      {copyOpen && selected ? (
        <ModalShell
          title={t("admin.availability.copySchedule")}
          onClose={() => setCopyOpen(false)}
          closeLabel={t("common.close")}
        >
          <div className="space-y-3">
            <div>
              <label className="label">
                {t("admin.availability.copyFrom")}
              </label>
              <select
                className="select"
                value={copyFromDate}
                onChange={(e) => setCopyFromDate(e.target.value)}
              >
                <option value="">
                  {t("admin.availability.selectExistingDate")}
                </option>
                {days
                  .filter((d) => d.id !== selected.id)
                  .map((d) => (
                    <option key={d.id} value={d.date}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">{t("admin.availability.copyTo")}</label>
              <input className="input" value={selected.label} readOnly />
            </div>
            <p className="admin-muted text-sm">
              {t("admin.availability.copyOverwrite")}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCopyOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                disabled={busy || !copyFromDate}
                onClick={() => void handleCopyConfirm()}
              >
                {t("admin.availability.confirmCopy")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "block w-full px-3 py-2.5 text-start text-sm font-medium hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50",
        danger ? "text-[var(--danger)]" : "text-[var(--ink)]",
      )}
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  closeLabel = "Close",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[rgba(11,15,20,0.75)] p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="admin-card w-full max-w-md rounded-b-none sm:rounded-[18px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="admin-section-title">{title}</h3>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
