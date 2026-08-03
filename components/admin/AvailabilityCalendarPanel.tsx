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
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
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
  const { t } = useLocale();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
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
    return days[0] || null;
  }, [days, selectedId, pickedDate, dayByDate]);

  useEffect(() => {
    if (selected) {
      setPickedDate(selected.date);
      setMonthCursor(parseYmd(selected.date));
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const summary = useMemo(() => {
    if (!selected) {
      return { available: 0, booked: 0, closed: 0, serviceCount: 0 };
    }
    let available = 0;
    let booked = 0;
    let closed = 0;
    for (const slot of selected.slots) {
      if (slot.isBooked) booked += 1;
      else if (slot.isEnabled) available += 1;
      else closed += 1;
    }
    return {
      available,
      booked,
      closed,
      serviceCount: isShared ? ALL_SERVICES.length : activeServices.length,
    };
  }, [selected, activeServices, isShared]);

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

  const weekdayKeys = ["0", "1", "2", "3", "4", "5", "6"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="admin-muted text-sm">{t("admin.availability.guide")}</p>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            setAddDate(pickedDate || "");
            setAddOpen(true);
          }}
        >
          <CalendarPlus size={16} />
          {t("admin.availability.addDate")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        {/* Calendar */}
        <section className="admin-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost !min-h-10 !px-3"
              onClick={() => setMonthCursor((d) => subMonths(d, 1))}
              aria-label={t("admin.availability.prevMonth")}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="admin-section-title text-base">
                {format(monthCursor, "MMMM yyyy")}
              </p>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-[var(--accent)]"
                onClick={() => {
                  const today = new Date();
                  setMonthCursor(today);
                  selectCalendarDate(today);
                }}
              >
                {t("admin.availability.today")}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost !min-h-10 !px-3"
              onClick={() => setMonthCursor((d) => addMonths(d, 1))}
              aria-label={t("admin.availability.nextMonth")}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-bold uppercase tracking-wide text-[var(--muted)]">
            {weekdayKeys.map((d) => (
              <div key={d} className="py-1">
                {t(`days.${d}`)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = ymd(day);
              const row = dayByDate.get(key);
              const inMonth = isSameMonth(day, monthCursor);
              const selectedDay = pickedDate === key || selected?.date === key;
              const hasBookings = Boolean(row?.slots.some((s) => s.isBooked));
              const isOpen = Boolean(row?.isOpen);
              const isClosed = Boolean(row && !row.isOpen);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectCalendarDate(day)}
                  className={cn(
                    "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition",
                    !inMonth && "opacity-35",
                    selectedDay
                      ? "border-[#D4AF6A] bg-[rgba(212,175,106,0.18)] text-[#D4AF6A]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[rgba(255,255,255,0.03)]",
                    isClosed && !selectedDay && "text-[var(--muted)]",
                  )}
                >
                  <span>{format(day, "d")}</span>
                  <span className="mt-0.5 flex h-2 items-center justify-center gap-0.5">
                    {row && isOpen ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5EC49A]" />
                    ) : null}
                    {hasBookings ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#6EA8FF]" />
                    ) : null}
                    {isClosed ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#77818A]" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[0.7rem] font-semibold text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#5EC49A]" />{" "}
              {t("admin.availability.legendOpen")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#6EA8FF]" />{" "}
              {t("admin.availability.legendBookings")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#77818A]" />{" "}
              {t("admin.availability.legendClosed")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#D4AF6A]" />{" "}
              {t("admin.availability.legendSelected")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-[rgba(94,196,154,0.55)] bg-[rgba(94,196,154,0.2)]" />{" "}
              {t("admin.availability.legendAvailable")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-[rgba(224,122,122,0.55)] bg-[rgba(224,122,122,0.2)]" />{" "}
              {t("admin.availability.legendBooked")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.06)]" />{" "}
              {t("admin.availability.legendUnavailable")}
            </span>
          </div>
        </section>

        {/* Details */}
        <section className="admin-card relative pb-20 lg:pb-5">
          {!selected ? (
            <div className="py-10 text-center">
              <p className="admin-section-title">
                {t("admin.availability.noDate")}
              </p>
              <p className="admin-page-desc mx-auto mt-2">
                {t("admin.availability.noDateLead")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="admin-kicker">
                    {t("admin.availability.selectedDate")}
                  </p>
                  <h2 className="admin-page-title mt-1 text-[1.55rem]">
                    {selected.label}
                  </h2>
                  <p className="admin-muted mt-1">{selected.date}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1",
                        selected.isOpen
                          ? "bg-[rgba(94,196,154,0.16)] text-[#5EC49A]"
                          : "bg-[rgba(119,129,138,0.2)] text-[#A7ADB5]",
                      )}
                    >
                      {selected.isOpen
                        ? t("admin.availability.open")
                        : t("admin.availability.closed")}
                    </span>
                    <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[var(--slate)]">
                      {t("admin.availability.servicesCount", {
                        n: summary.serviceCount,
                      })}
                      {isShared
                        ? ` · ${t("admin.availability.shared")}`
                        : ""}
                    </span>
                    <span className="rounded-full bg-[rgba(94,196,154,0.12)] px-2.5 py-1 text-[#5EC49A]">
                      {t("admin.availability.availableCount", {
                        n: summary.available,
                      })}
                    </span>
                    <span className="rounded-full bg-[rgba(224,122,122,0.12)] px-2.5 py-1 text-[#E07A7A]">
                      {t("admin.availability.bookedCount", {
                        n: summary.booked,
                      })}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    className="btn btn-ghost !min-h-11"
                    onClick={() => setMoreOpen((v) => !v)}
                    aria-expanded={moreOpen}
                  >
                    <MoreHorizontal size={16} />
                    {t("admin.availability.more")}
                  </button>
                  {moreOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-20 cursor-default"
                        aria-label={t("common.close")}
                        onClick={() => setMoreOpen(false)}
                      />
                      <div className="absolute end-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--admin-card)] shadow-xl">
                        <MenuButton
                          disabled={busy}
                          onClick={() => {
                            setMoreOpen(false);
                            void onPatchDay({ isOpen: !selected.isOpen });
                          }}
                        >
                          {selected.isOpen
                            ? t("admin.availability.markClosed")
                            : t("admin.availability.markOpen")}
                        </MenuButton>
                        <MenuButton
                          disabled={busy}
                          onClick={() => {
                            setCopyFromDate("");
                            setCopyOpen(true);
                            setMoreOpen(false);
                          }}
                        >
                          {t("admin.availability.copySchedule")}
                        </MenuButton>
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
                                ...s,
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

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="admin-card-label">
                    {t("admin.availability.services")}
                  </p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--accent)]"
                    disabled={busy || isShared}
                    onClick={() => void selectAllServices()}
                  >
                    {t("admin.availability.selectAllShared")}
                  </button>
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
                  {ALL_SERVICES.map((service) => {
                    const active = activeServices.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleService(service)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap transition",
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
                <p className="admin-muted mt-2 text-xs">
                  {isShared
                    ? t("admin.availability.sharedLead")
                    : t("admin.availability.separateLead")}
                </p>
              </div>

              <div className="mt-5">
                <p className="admin-card-label mb-2">
                  {t("admin.availability.timeSlots")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {selected.slots.map((slot) => {
                    const booked = Boolean(slot.isBooked);
                    const available = slot.isEnabled && !booked;
                    const closed = !slot.isEnabled && !booked;
                    const status = slotStatusLabel(booked, available);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={busy}
                        title={`${slot.time} — ${status}${
                          booked && slot.bookedBy ? ` · ${slot.bookedBy}` : ""
                        }`}
                        onClick={() => {
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
                          "rounded-xl border px-2.5 py-2.5 text-start transition",
                          available &&
                            "border-[rgba(94,196,154,0.35)] bg-[rgba(94,196,154,0.1)] text-[#5EC49A]",
                          booked &&
                            "border-[rgba(224,122,122,0.35)] bg-[rgba(224,122,122,0.12)] text-[#E07A7A]",
                          closed &&
                            "border-[var(--line)] bg-[rgba(255,255,255,0.03)] text-[#77818A]",
                        )}
                      >
                        <strong className="block text-sm font-bold tabular-nums">
                          {slot.time}
                        </strong>
                        <span className="mt-0.5 block text-[0.65rem] font-bold uppercase tracking-wide">
                          {status}
                        </span>
                        {booked && slot.bookedBy ? (
                          <span className="mt-1 block truncate text-[0.7rem] opacity-90">
                            {slot.bookedBy}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile sticky add / open more */}
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[rgba(11,15,20,0.92)] p-3 backdrop-blur lg:hidden">
                <div className="mx-auto flex max-w-lg gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={() => setMoreOpen(true)}
                  >
                    {t("admin.availability.more")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-accent flex-1"
                    onClick={() => {
                      setAddDate(selected.date);
                      setAddOpen(true);
                    }}
                  >
                    <CalendarPlus size={16} />
                    {t("admin.availability.addDate")}
                  </button>
                </div>
              </div>

              {/* Mobile more sheet */}
              {moreOpen ? (
                <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
                  <button
                    type="button"
                    className="absolute inset-0 bg-[rgba(11,15,20,0.7)]"
                    aria-label={t("common.close")}
                    onClick={() => setMoreOpen(false)}
                  />
                  <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-[var(--line)] bg-[var(--admin-card)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                    <p className="admin-section-title mb-3 text-base">
                      {t("admin.availability.dateActions")}
                    </p>
                    <div className="space-y-1">
                      <MenuButton
                        disabled={busy}
                        onClick={() => {
                          setMoreOpen(false);
                          void onPatchDay({ isOpen: !selected.isOpen });
                        }}
                      >
                        {selected.isOpen
                          ? t("admin.availability.markClosed")
                          : t("admin.availability.markOpen")}
                      </MenuButton>
                      <MenuButton
                        disabled={busy}
                        onClick={() => {
                          setCopyFromDate("");
                          setCopyOpen(true);
                          setMoreOpen(false);
                        }}
                      >
                        {t("admin.availability.copySchedule")}
                      </MenuButton>
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
                              ...s,
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
                  </div>
                </div>
              ) : null}
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
          <p className="mt-2 text-sm text-[var(--danger)] font-semibold">
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
