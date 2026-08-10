"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import type { ClinicAppointmentType } from "@/lib/types";

const GOLD = "#D4AF37";
const MUTED = "#8B93A0";
const PAGE_BG = "#0B0E14";
const CARD_BG = "#151A21";
const BORDER = "#2A2F36";
const INK = "#FFFFFF";

export type BookingRow = {
  id: string;
  fullName: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: ClinicAppointmentType;
  notes?: string;
};

type ViewMode = "weekly" | "list";

type Props = {
  appointments: BookingRow[];
  loading: boolean;
  busy: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  dateFilter: string;
  onDateFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onOpenRow: (row: BookingRow) => void;
  serviceLabel: (type: string) => string;
};

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Week always runs Sunday → Saturday (7 days). */
function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function splitTime(time: string): { clock: string; period: string } {
  if (!time) return { clock: "", period: "" };
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { clock: time, period: "" };
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { clock, period: h < 12 ? "صباحاً" : "مساءً" };
}

function weekdayShortAr(d: Date): string {
  return d.toLocaleDateString("ar", { weekday: "short" });
}

function weekdayLongAr(d: Date): string {
  return d.toLocaleDateString("ar", { weekday: "long" });
}

function dayMonthAr(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function rangeLabelAr(start: Date, end: Date): string {
  const a = start.getDate();
  const b = end.getDate();
  const month = end.toLocaleDateString("ar", { month: "long" });
  const year = end.getFullYear();
  return `${a} - ${b} ${month} ${year}`;
}

function longDayAr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function shortDateAr(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("ar", {
    day: "numeric",
    month: "short",
  });
}

/** Compact single-line date for mobile list rows, e.g. 10/08/26 */
function compactListDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return shortDateAr(iso);
  return `${d}/${m}/${y.slice(2)}`;
}

const fieldStyle: CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD_BG,
  color: INK,
  padding: "0 0.75rem",
  font: "inherit",
  fontSize: "0.84rem",
  outline: "none",
  width: "100%",
};

export default function BookingsPanel({
  appointments,
  loading,
  busy,
  query,
  onQueryChange,
  dateFilter,
  onDateFilterChange,
  typeFilter,
  onTypeFilterChange,
  onRefresh,
  onAdd,
  onOpenRow,
  serviceLabel,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeekSunday(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => isoLocal(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekAnchor, i);
      const iso = isoLocal(d);
      const count = appointments.filter(
        (a) => a.appointmentDate === iso,
      ).length;
      return { date: d, iso, count };
    });
  }, [weekAnchor, appointments]);

  const weekEnd = addDays(weekAnchor, 6);

  const visible = useMemo(() => {
    let rows = [...appointments];
    if (viewMode === "weekly") {
      rows = rows.filter((a) => a.appointmentDate === selectedDay);
    } else if (dateFilter) {
      rows = rows.filter((a) => a.appointmentDate === dateFilter);
    }
    rows.sort((a, b) => {
      const byDate = a.appointmentDate.localeCompare(b.appointmentDate);
      if (byDate !== 0) return byDate;
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });
    return rows;
  }, [appointments, viewMode, selectedDay, dateFilter]);

  function shiftWeek(delta: number) {
    const next = addDays(weekAnchor, delta * 7);
    setWeekAnchor(startOfWeekSunday(next));
    setSelectedDay(isoLocal(next));
  }

  return (
    <div
      className="admin-bookings-panel flex flex-col"
      style={{ color: INK, gap: 18 }}
    >
      {/* Title + actions */}
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1
              className="m-0 text-[1.45rem] font-semibold tracking-[-0.02em] lg:text-[1.7rem]"
              style={{ color: INK, lineHeight: 1.3 }}
            >
              الحجوزات
            </h1>
            <CalendarDays size={24} strokeWidth={1.45} color={GOLD} aria-hidden />
          </div>
          <p
            className="mb-0 mt-1.5 text-[0.84rem] leading-relaxed lg:text-[0.9rem]"
            style={{ color: MUTED }}
          >
            عرض جميع الحجوزات وإدارتها بسهولة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-1 rounded-[12px] text-[0.84rem] font-bold"
            style={{
              height: 44,
              width: "42%",
              maxWidth: 148,
              background: GOLD,
              color: "#0B0E14",
              border: "none",
              paddingInline: 10,
            }}
          >
            موعد جديد
            <Plus size={15} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-[12px] px-3.5 text-[0.84rem] font-semibold disabled:opacity-50"
            style={{
              height: 44,
              background: CARD_BG,
              color: INK,
              border: `1px solid ${BORDER}`,
            }}
          >
            <RefreshCw size={16} strokeWidth={1.5} color={GOLD} />
            تحديث
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div
        className="grid grid-cols-2 gap-1.5 rounded-[14px] p-1.5 lg:inline-grid lg:w-auto"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
      >
        <button
          type="button"
          onClick={() => setViewMode("weekly")}
          className="inline-flex items-center justify-center gap-2 rounded-[11px] px-3.5 text-[0.82rem] font-bold"
          style={{
            height: 42,
            background: viewMode === "weekly" ? GOLD : "transparent",
            color: viewMode === "weekly" ? "#0B0E14" : INK,
            border: "none",
          }}
        >
          <CalendarDays
            size={16}
            strokeWidth={1.5}
            color={viewMode === "weekly" ? "#0B0E14" : GOLD}
          />
          عرض جدول أسبوعي
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className="inline-flex items-center justify-center gap-2 rounded-[11px] px-3.5 text-[0.82rem] font-bold"
          style={{
            height: 42,
            background: viewMode === "list" ? GOLD : "transparent",
            color: viewMode === "list" ? "#0B0E14" : INK,
            border: "none",
          }}
        >
          <List
            size={16}
            strokeWidth={1.5}
            color={viewMode === "list" ? "#0B0E14" : GOLD}
          />
          عرض قائمة
        </button>
      </div>

      {/* Search — weekly: search only | list: search + date + service */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: GOLD }}
          />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ابحث باسم العميل أو رقم الهاتف..."
            aria-label="بحث"
            style={{
              ...fieldStyle,
              height: 44,
              paddingInlineStart: 38,
              border: `1px solid ${BORDER}`,
            }}
          />
        </div>

        {viewMode === "list" ? (
          <>
            <label className="relative block lg:w-[12rem]">
              <CalendarDays
                size={15}
                strokeWidth={1.5}
                className="pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2"
                style={{ insetInlineStart: 12, color: GOLD }}
              />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  onDateFilterChange(e.target.value);
                  if (e.target.value) {
                    const d = new Date(`${e.target.value}T12:00:00`);
                    setWeekAnchor(startOfWeekSunday(d));
                    setSelectedDay(e.target.value);
                  }
                }}
                style={{
                  ...fieldStyle,
                  height: 44,
                  paddingInlineStart: 36,
                }}
              />
            </label>

            <label className="relative block lg:w-[12.5rem]">
              <Filter
                size={15}
                strokeWidth={1.5}
                className="pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2"
                style={{ insetInlineStart: 12, color: GOLD }}
              />
              <select
                value={typeFilter}
                onChange={(e) => onTypeFilterChange(e.target.value)}
                style={{
                  ...fieldStyle,
                  height: 44,
                  paddingInlineStart: 36,
                  appearance: "none",
                }}
              >
                <option value="all">كل الخدمات</option>
                <option value="eye_exam">{serviceLabel("eye_exam")}</option>
                <option value="contact_lens_fitting">
                  {serviceLabel("contact_lens_fitting")}
                </option>
                <option value="frame_consultation">
                  {serviceLabel("frame_consultation")}
                </option>
                <option value="sunglasses_consultation">
                  {serviceLabel("sunglasses_consultation")}
                </option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      {/* Weekly strip */}
      {viewMode === "weekly" ? (
        <section
          className="rounded-[16px] px-3 pb-3.5 pt-3 lg:px-[14px] lg:pb-[18px] lg:pt-4"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            height: "fit-content",
          }}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2 lg:mb-4 lg:gap-3">
            <h2
              className="m-0 text-[0.95rem] font-semibold lg:text-[1.05rem]"
              style={{ color: INK }}
            >
              جدول الأسبوع
            </h2>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <button
                type="button"
                aria-label="الأسبوع السابق"
                onClick={() => shiftWeek(-1)}
                className="grid place-items-center rounded-[10px]"
                style={{
                  width: 34,
                  height: 34,
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                  color: GOLD,
                }}
              >
                <ChevronRight size={15} strokeWidth={1.6} />
              </button>
              <span
                className="min-w-0 text-center text-[0.72rem] font-semibold lg:min-w-[10rem] lg:text-[0.8rem]"
                style={{ color: MUTED }}
              >
                {rangeLabelAr(weekAnchor, weekEnd)}
              </span>
              <button
                type="button"
                aria-label="الأسبوع التالي"
                onClick={() => shiftWeek(1)}
                className="grid place-items-center rounded-[10px]"
                style={{
                  width: 34,
                  height: 34,
                  background: PAGE_BG,
                  border: `1px solid ${BORDER}`,
                  color: GOLD,
                }}
              >
                <ChevronLeft size={15} strokeWidth={1.6} />
              </button>
            </div>
          </div>

          <div className="flex gap-[5px] overflow-hidden lg:grid lg:grid-cols-7 lg:gap-3.5 lg:overflow-visible">
            {weekDays.map((day) => {
              const active = day.iso === selectedDay;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day.iso);
                    onDateFilterChange(day.iso);
                  }}
                  className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-[12px] px-0.5 py-2 gap-1.5 aspect-[1/1.05] lg:aspect-auto lg:min-w-0 lg:justify-start lg:rounded-[14px] lg:px-2.5 lg:py-4 lg:gap-2"
                  style={{
                    background: active ? GOLD : PAGE_BG,
                    border: active
                      ? `1.5px solid ${GOLD}`
                      : `1px solid ${BORDER}`,
                    color: active ? "#0B0E14" : INK,
                    boxShadow: active
                      ? "0 0 0 1px rgba(212,175,55,0.35)"
                      : "none",
                  }}
                >
                  <span className="max-w-full truncate text-[0.62rem] font-semibold leading-none lg:text-[0.82rem] lg:leading-snug">
                    <span className="lg:hidden">{weekdayShortAr(day.date)}</span>
                    <span className="hidden lg:inline">{weekdayLongAr(day.date)}</span>
                  </span>
                  <span className="text-[0.82rem] font-bold tabular-nums leading-none lg:text-[1.02rem]">
                    {dayMonthAr(day.date)}
                  </span>
                  <span
                    className="text-[0.68rem] font-bold tabular-nums leading-none lg:text-[0.8rem]"
                    style={{ color: active ? "#0B0E14" : GOLD }}
                  >
                    {day.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Results block — clear separation from weekly schedule */}
      <div className="flex flex-col gap-3.5 lg:gap-4">
        <p
          className="m-0 text-[0.9rem] font-bold tabular-nums lg:text-[0.95rem]"
          style={{ color: GOLD }}
        >
          {viewMode === "weekly" ? (
            <>
              {visible.length} {longDayAr(selectedDay)}
            </>
          ) : (
            <>{visible.length} حجز</>
          )}
        </p>

        <section
          className="overflow-hidden rounded-[16px]"
          style={{
            background: CARD_BG,
            border: `1px solid ${BORDER}`,
            height: "fit-content",
          }}
        >
          {loading ? (
            <p className="m-0 px-4 py-7 text-sm" style={{ color: MUTED }}>
              جارٍ التحميل…
            </p>
          ) : visible.length === 0 ? (
            <p className="m-0 px-4 py-7 text-sm" style={{ color: MUTED }}>
              لا توجد حجوزات
            </p>
          ) : (
            <>
              {/* Desktop headers */}
              <div
                className="hidden grid-cols-[7.75rem_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.75fr)_1.75rem] gap-4 px-5 pb-2.5 pt-4 text-[0.74rem] font-medium lg:grid"
                style={{ color: MUTED }}
              >
                <span>{viewMode === "list" ? "التاريخ / الوقت" : "الوقت"}</span>
                <span>العميل</span>
                <span>رقم الهاتف</span>
                <span>الخدمة</span>
                <span>ملاحظات</span>
                <span />
              </div>

              <ul className="m-0 list-none p-0">
                {visible.map((row) => {
                  const { clock, period } = splitTime(row.appointmentTime);
                  const showDate = viewMode === "list";
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => onOpenRow(row)}
                        className="block w-full text-start"
                        style={{
                          background: "transparent",
                          border: "none",
                          borderTop: `1px solid rgba(42,47,54,0.95)`,
                          padding: 0,
                        }}
                      >
                        {/* Desktop row */}
                        <div className="hidden grid-cols-[7.75rem_minmax(0,1.25fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.75fr)_1.75rem] items-center gap-4 px-5 py-3.5 lg:grid">
                          <div>
                            {showDate ? (
                              <p
                                className="m-0 text-[0.72rem] font-semibold leading-tight"
                                style={{ color: MUTED }}
                              >
                                {shortDateAr(row.appointmentDate)}
                              </p>
                            ) : null}
                            <p
                              className="m-0 text-[1rem] font-bold tabular-nums leading-tight"
                              style={{
                                color: GOLD,
                                marginTop: showDate ? 4 : 0,
                              }}
                            >
                              {clock}
                            </p>
                            <p
                              className="mb-0 mt-0.5 text-[0.72rem] font-medium leading-tight"
                              style={{ color: GOLD }}
                            >
                              {period}
                            </p>
                          </div>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <User size={17} strokeWidth={1.45} color={GOLD} />
                            <span
                              className="truncate text-[0.92rem] font-semibold"
                              style={{ color: INK }}
                            >
                              {row.fullName}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Phone size={17} strokeWidth={1.45} color={GOLD} />
                            <span
                              className="truncate text-[0.88rem] tabular-nums"
                              style={{ color: INK }}
                              dir="ltr"
                            >
                              {row.phone || "—"}
                            </span>
                          </div>
                          <span
                            className="truncate text-[0.88rem]"
                            style={{ color: INK }}
                          >
                            {serviceLabel(row.appointmentType || "eye_exam")}
                          </span>
                          <span
                            className="truncate text-[0.84rem]"
                            style={{ color: MUTED }}
                          >
                            {row.notes?.trim() ? row.notes : "—"}
                          </span>
                          <ChevronLeft size={18} strokeWidth={1.55} color={GOLD} />
                        </div>

                        {/* Mobile — weekly: hour | name | phone; list: phone | name | hour | date */}
                        {showDate ? (
                          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_3.15rem_3.35rem] items-center gap-2 px-3 py-2.5 lg:hidden">
                            <div className="flex min-w-0 items-center gap-1">
                              <Phone
                                size={12}
                                strokeWidth={1.45}
                                color={GOLD}
                                className="shrink-0"
                              />
                              <span
                                className="truncate text-[0.7rem] tabular-nums"
                                style={{ color: MUTED }}
                                dir="ltr"
                              >
                                {row.phone || "—"}
                              </span>
                            </div>
                            <span
                              className="min-w-0 truncate text-[0.82rem] font-semibold"
                              style={{ color: INK }}
                            >
                              {row.fullName}
                            </span>
                            <span
                              className="text-center text-[0.82rem] font-bold tabular-nums"
                              style={{ color: GOLD }}
                              dir="ltr"
                            >
                              {clock}
                            </span>
                            <span
                              className="text-center text-[0.72rem] font-semibold tabular-nums"
                              style={{ color: MUTED }}
                              dir="ltr"
                            >
                              {compactListDate(row.appointmentDate)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-3.5 py-3 lg:hidden">
                            <div className="w-[3.6rem] shrink-0" style={{ minWidth: "3.6rem" }}>
                              <p
                                className="m-0 whitespace-nowrap text-[0.9rem] font-bold tabular-nums leading-tight"
                                style={{ color: GOLD }}
                                dir="ltr"
                              >
                                {clock}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <User
                                  size={14}
                                  strokeWidth={1.45}
                                  color={GOLD}
                                  className="shrink-0"
                                />
                                <span
                                  className="truncate text-[0.86rem] font-semibold"
                                  style={{ color: INK }}
                                >
                                  {row.fullName}
                                </span>
                              </div>
                              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                <Phone
                                  size={13}
                                  strokeWidth={1.45}
                                  color={GOLD}
                                  className="shrink-0"
                                />
                                <span
                                  className="truncate text-[0.74rem] tabular-nums"
                                  style={{ color: MUTED }}
                                  dir="ltr"
                                >
                                  {row.phone || "—"}
                                </span>
                              </div>
                            </div>
                            <ChevronLeft
                              size={17}
                              strokeWidth={1.55}
                              color={GOLD}
                              className="shrink-0"
                            />
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
