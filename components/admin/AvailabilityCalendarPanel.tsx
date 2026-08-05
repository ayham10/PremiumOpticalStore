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
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Info,
  Plus,
  Save,
  Trash2,
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

export type AvailabilityPeriod = {
  id: string;
  start: string;
  end: string;
  enabled: boolean;
};

export type AvailabilityDay = {
  id: string;
  date: string;
  label: string;
  isOpen: boolean;
  slots: AvailabilitySlot[];
  periods?: AvailabilityPeriod[];
  isException?: boolean;
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

type DraftPeriod = {
  id: string;
  start: string;
  end: string;
  enabled: boolean;
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function newPeriodId() {
  return `period_${Math.random().toString(36).slice(2, 10)}`;
}

function clonePeriods(periods: AvailabilityPeriod[]): DraftPeriod[] {
  return periods.map((p) => ({
    id: p.id || newPeriodId(),
    start: p.start,
    end: p.end,
    enabled: p.enabled !== false,
  }));
}

function defaultPeriodFromTimes(defaultTimes: string[]): DraftPeriod {
  const sorted = [...defaultTimes].sort();
  const start = sorted[0] || "09:00";
  const end = sorted[Math.min(sorted.length - 1, 8)] || "13:00";
  return {
    id: newPeriodId(),
    start,
    end: end > start ? end : "13:00",
    enabled: true,
  };
}

function periodsEqual(a: DraftPeriod[], b: DraftPeriod[]) {
  if (a.length !== b.length) return false;
  return a.every((row, i) => {
    const other = b[i];
    return (
      row.start === other.start &&
      row.end === other.end &&
      row.enabled === other.enabled
    );
  });
}

function dayPeriods(day: AvailabilityDay | null | undefined): DraftPeriod[] {
  if (!day) return [];
  if (day.periods?.length) return clonePeriods(day.periods);
  // Fallback: infer a single span from enabled slots when periods are missing
  const enabled = day.slots
    .filter((s) => s.isEnabled)
    .map((s) => s.time)
    .sort();
  if (!enabled.length) return [];
  return [
    {
      id: newPeriodId(),
      start: enabled[0],
      end: enabled[enabled.length - 1],
      enabled: true,
    },
  ];
}

export default function AvailabilityCalendarPanel({
  days,
  defaultTimes,
  busy,
  selectedId,
  onSelectDayId,
  onPatchDay,
  onCreateDay,
}: Props) {
  const { t, locale } = useLocale();
  const dateLocale = locale === "ar" ? ar : locale === "he" ? he : enUS;

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [pickedDate, setPickedDate] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFromDate, setCopyFromDate] = useState("");
  const [draftPeriods, setDraftPeriods] = useState<DraftPeriod[]>([]);
  const [creatingDate, setCreatingDate] = useState<string | null>(null);

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

  const periodsSyncKey = selected
    ? `${selected.id}|${selected.isOpen}|${(selected.periods || [])
        .map((p) => `${p.id}:${p.start}-${p.end}:${p.enabled}`)
        .join(",")}`
    : "";

  useEffect(() => {
    if (selected) {
      setPickedDate(selected.date);
      setMonthCursor(parseYmd(selected.date));
      setDraftPeriods(dayPeriods(selected));
    } else {
      setDraftPeriods([]);
    }
  }, [periodsSyncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [monthCursor]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    return !periodsEqual(draftPeriods, dayPeriods(selected));
  }, [draftPeriods, selected]);

  const bookedSlots = useMemo(
    () => (selected?.slots || []).filter((s) => s.isBooked),
    [selected],
  );

  async function selectCalendarDate(day: Date) {
    const key = ymd(day);
    setPickedDate(key);
    const existing = dayByDate.get(key);
    if (existing) {
      onSelectDayId?.(existing.id);
      return;
    }
    onSelectDayId?.("");
    if (busy || creatingDate === key) return;
    setCreatingDate(key);
    try {
      await onCreateDay({
        date: key,
        services: [...ALL_SERVICES],
      });
    } finally {
      setCreatingDate(null);
    }
  }

  function findPreviousDayWithPeriods(date: string): AvailabilityDay | null {
    const earlier = days
      .filter((d) => d.date < date)
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const day of earlier) {
      const periods = dayPeriods(day);
      if (periods.length > 0) return day;
    }
    return null;
  }

  async function handleCopyPreviousDay() {
    if (!selected || busy) return;
    const source = findPreviousDayWithPeriods(selected.date);
    if (!source) {
      window.alert(t("admin.availability.noPreviousDay"));
      return;
    }
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
      id: selected.id,
      copyFromDate: source.date,
      isException: true,
    });
  }

  function openCopyModal() {
    if (!selected) return;
    setCopyFromDate("");
    setCopyOpen(true);
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
      id: selected.id,
      copyFromDate: source.date,
      isException: true,
    });
    setCopyOpen(false);
  }

  function addPeriod() {
    setDraftPeriods((prev) => [...prev, defaultPeriodFromTimes(defaultTimes)]);
  }

  function updatePeriod(
    id: string,
    patch: Partial<Pick<DraftPeriod, "start" | "end" | "enabled">>,
  ) {
    setDraftPeriods((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removePeriod(id: string) {
    setDraftPeriods((prev) => prev.filter((row) => row.id !== id));
  }

  async function handleSavePeriods() {
    if (!selected || busy) return;
    await onPatchDay({
      id: selected.id,
      periods: draftPeriods.map((p) => ({
        id: p.id,
        start: p.start,
        end: p.end,
        enabled: p.enabled,
      })),
      isException: true,
    });
  }

  async function handleToggleClosed() {
    if (!selected || busy) return;
    await onPatchDay({
      id: selected.id,
      isOpen: !selected.isOpen,
      isException: true,
    });
  }

  function dayDotClass(row: AvailabilityDay | undefined) {
    if (!row) return "is-none";
    if (!row.isOpen) return "is-closed";
    if (row.slots.some((s) => s.isBooked)) return "is-limited";
    if (row.isException) return "is-exception";
    return "is-open";
  }

  const weekdayKeys = ["0", "1", "2", "3", "4", "5", "6"] as const;

  return (
    <div className="admin-wh-shell">
      <div className="admin-wh-grid">
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
                  onClick={() => void selectCalendarDate(day)}
                  disabled={busy && creatingDate === key}
                  className={cn(
                    "admin-wh-day-cell",
                    !inMonth && "is-outside",
                    selectedDay && "is-selected",
                    row?.isException && "is-exception-day",
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
              <i className="admin-wh-day-dot is-exception" />
              {t("admin.availability.legendException")}
            </span>
            <span>
              <i className="admin-wh-day-dot is-limited" />
              {t("admin.availability.legendLimited")}
            </span>
            <span>
              <i className="admin-wh-day-dot is-closed" />
              {t("admin.availability.closed")}
            </span>
          </div>
        </section>

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
                  <div className="admin-wh-day-heading-text">
                    <h2 className="admin-wh-day-label">{selected.label}</h2>
                    {selected.isException ? (
                      <span className="admin-wh-exception-badge">
                        {t("admin.availability.exceptionBadge")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="admin-wh-actions">
                <button
                  type="button"
                  className="admin-wh-action"
                  disabled={busy}
                  onClick={() => void handleCopyPreviousDay()}
                >
                  <Copy size={15} />
                  {t("admin.availability.copyPreviousDay")}
                </button>
                <button
                  type="button"
                  className="admin-wh-action"
                  disabled={busy}
                  onClick={openCopyModal}
                >
                  <Copy size={15} />
                  {t("admin.availability.copyFromAnother")}
                </button>
                <button
                  type="button"
                  className="admin-wh-action"
                  disabled={busy || !selected.isOpen}
                  onClick={addPeriod}
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
                  onClick={() => void handleToggleClosed()}
                >
                  <Ban size={15} />
                  {selected.isOpen
                    ? t("admin.availability.markClosed")
                    : t("admin.availability.markOpen")}
                </button>
                <button
                  type="button"
                  className={cn("admin-wh-action", "is-primary", dirty && "is-dirty")}
                  disabled={busy || !dirty || !selected.isOpen}
                  onClick={() => void handleSavePeriods()}
                >
                  <Save size={15} />
                  {t("admin.availability.saveChanges")}
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
                    ? t("admin.availability.scheduleLead")
                    : t("admin.availability.dayClosedLead")}
                </span>
              </div>

              {selected.isOpen ? (
                <>
                  <div className="admin-wh-slots-head">
                    <Clock size={16} className="admin-wh-gold-icon" />
                    <h3>{t("admin.availability.scheduleTitle")}</h3>
                  </div>

                  <div className="admin-wh-periods">
                    <div className="admin-wh-period-head" aria-hidden="true">
                      <span>{t("admin.availability.startTime")}</span>
                      <span>{t("admin.availability.endTime")}</span>
                      <span>{t("admin.availability.enablePeriod")}</span>
                      <span className="admin-wh-period-head-action">
                        {t("admin.availability.deletePeriod")}
                      </span>
                    </div>

                    {draftPeriods.length === 0 ? (
                      <div className="admin-wh-periods-empty">
                        <p>{t("admin.availability.noPeriods")}</p>
                        <button
                          type="button"
                          className="admin-wh-action"
                          disabled={busy}
                          onClick={addPeriod}
                        >
                          <Plus size={15} />
                          {t("admin.availability.addTime")}
                        </button>
                      </div>
                    ) : (
                      draftPeriods.map((period) => (
                        <div
                          key={period.id}
                          className={cn(
                            "admin-wh-period-row",
                            !period.enabled && "is-disabled",
                          )}
                        >
                          <label className="admin-wh-period-field">
                            <span className="admin-wh-period-mobile-label">
                              {t("admin.availability.startTime")}
                            </span>
                            <input
                              type="time"
                              className="admin-wh-period-input"
                              value={period.start}
                              disabled={busy}
                              onChange={(e) =>
                                updatePeriod(period.id, {
                                  start: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="admin-wh-period-field">
                            <span className="admin-wh-period-mobile-label">
                              {t("admin.availability.endTime")}
                            </span>
                            <input
                              type="time"
                              className="admin-wh-period-input"
                              value={period.end}
                              disabled={busy}
                              onChange={(e) =>
                                updatePeriod(period.id, {
                                  end: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="admin-wh-period-toggle">
                            <span className="admin-wh-period-mobile-label">
                              {t("admin.availability.enablePeriod")}
                            </span>
                            <input
                              type="checkbox"
                              checked={period.enabled}
                              disabled={busy}
                              onChange={(e) =>
                                updatePeriod(period.id, {
                                  enabled: e.target.checked,
                                })
                              }
                            />
                            <span className="admin-wh-period-switch" />
                          </label>
                          <button
                            type="button"
                            className="admin-wh-period-delete"
                            disabled={busy}
                            aria-label={t("admin.availability.deletePeriod")}
                            onClick={() => removePeriod(period.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {bookedSlots.length > 0 ? (
                    <p className="admin-wh-booked-hint">
                      <Info size={14} />
                      <span>
                        {t("admin.availability.bookedSummary", {
                          n: String(bookedSlots.length),
                          times: bookedSlots.map((s) => s.time).join(", "),
                        })}
                      </span>
                    </p>
                  ) : null}

                  <p className="admin-wh-tip">
                    <Info size={14} />
                    {t("admin.availability.periodTip")}
                  </p>
                </>
              ) : null}
            </>
          )}
        </section>
      </div>

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
