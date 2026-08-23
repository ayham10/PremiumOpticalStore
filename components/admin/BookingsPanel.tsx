"use client";

import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Eye,
  Filter,
  Glasses,
  List,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import type { ClinicAppointmentType } from "@/lib/types";

const GOLD = "#D4AF37";

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

function formatTime24(time: string): string {
  if (!time) return "—";
  const [h, m] = time.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return time;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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

function toWhatsAppHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) {
    digits = `972${digits.slice(1)}`;
  }
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}

function WhatsAppGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9 9 0 1 1 12 20.5zm4.9-6.7c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3z" />
    </svg>
  );
}

const SERVICE_ICONS: Record<string, LucideIcon> = {
  eye_exam: Eye,
  contact_lens_fitting: CircleDot,
  frame_consultation: Glasses,
  sunglasses_consultation: Sun,
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
  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeekSunday(new Date()),
  );
  const [selectedDay, setSelectedDay] = useState(() => isoLocal(new Date()));
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const viewingAllDates = viewMode === "list" && !dateFilter && !upcomingOnly;
  const viewingUpcoming = viewMode === "list" && upcomingOnly;

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        void input.showPicker();
        return;
      }
    } catch {
      /* showPicker can throw if not triggered by a user gesture in some browsers */
    }
    input.focus();
    input.click();
  }

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekAnchor, i);
      const iso = isoLocal(d);
      const count = appointments.filter((a) => a.appointmentDate === iso).length;
      return { date: d, iso, count };
    });
  }, [weekAnchor, appointments]);

  const weekEnd = addDays(weekAnchor, 6);

  const stats = useMemo(() => {
    const today = isoLocal(new Date());
    const weekStartIso = isoLocal(startOfWeekSunday(new Date()));
    const weekEndIso = isoLocal(addDays(startOfWeekSunday(new Date()), 6));
    const monthPrefix = today.slice(0, 7);
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    for (const row of appointments) {
      if (row.appointmentDate === today) todayCount += 1;
      if (
        row.appointmentDate >= weekStartIso &&
        row.appointmentDate <= weekEndIso
      ) {
        weekCount += 1;
      }
      if (row.appointmentDate.startsWith(monthPrefix)) monthCount += 1;
    }
    return {
      todayCount,
      weekCount,
      monthCount,
      total: appointments.length,
    };
  }, [appointments]);

  const visible = useMemo(() => {
    const today = isoLocal(new Date());
    let rows = [...appointments];
    if (viewMode === "weekly") {
      rows = rows.filter((a) => a.appointmentDate === selectedDay);
    } else if (upcomingOnly) {
      rows = rows.filter((a) => a.appointmentDate >= today);
    } else if (dateFilter) {
      rows = rows.filter((a) => a.appointmentDate === dateFilter);
    }
    rows.sort((a, b) => {
      const byDate = a.appointmentDate.localeCompare(b.appointmentDate);
      if (byDate !== 0) return byDate;
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });
    return rows;
  }, [appointments, viewMode, selectedDay, dateFilter, upcomingOnly]);

  function shiftWeek(delta: number) {
    const next = addDays(weekAnchor, delta * 7);
    setWeekAnchor(startOfWeekSunday(next));
    setSelectedDay(isoLocal(next));
  }

  function viewAllDates() {
    setViewMode("list");
    setUpcomingOnly(false);
    onDateFilterChange("");
  }

  function viewUpcoming() {
    setViewMode("list");
    setUpcomingOnly(true);
    onDateFilterChange("");
  }

  function applyDate(iso: string) {
    setUpcomingOnly(false);
    onDateFilterChange(iso);
    if (!iso) return;
    const d = new Date(`${iso}T12:00:00`);
    setWeekAnchor(startOfWeekSunday(d));
    setSelectedDay(iso);
  }

  return (
    <div className="admin-bookings-panel abk-panel">
      <div className="abk-hero">
        <div className="abk-hero-copy">
          <div className="abk-hero-title">
            <h1>الحجوزات</h1>
            <CalendarDays size={24} strokeWidth={1.45} color={GOLD} aria-hidden />
          </div>
          <p>عرض جميع الحجوزات وإدارتها بسهولة</p>
        </div>
        <div className="abk-hero-actions">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || busy}
            className="abk-btn"
          >
            <RefreshCw size={14} strokeWidth={1.6} />
            تحديث
          </button>
          <button type="button" onClick={onAdd} className="abk-btn abk-btn-add">
            <Plus size={14} strokeWidth={1.7} />
            موعد جديد
          </button>
        </div>
      </div>

      <section className="abk-stats" aria-label="ملخص الحجوزات">
        <article className="abk-stat">
          <span className="abk-stat-icon">
            <CalendarDays size={16} strokeWidth={1.6} />
          </span>
          <div className="abk-stat-copy">
            <span className="abk-stat-label">اليوم</span>
            <strong className="abk-stat-value">{stats.todayCount}</strong>
          </div>
        </article>
        <article className="abk-stat">
          <span className="abk-stat-icon">
            <CalendarRange size={16} strokeWidth={1.6} />
          </span>
          <div className="abk-stat-copy">
            <span className="abk-stat-label">هذا الأسبوع</span>
            <strong className="abk-stat-value">{stats.weekCount}</strong>
          </div>
        </article>
        <article className="abk-stat">
          <span className="abk-stat-icon">
            <Calendar size={16} strokeWidth={1.6} />
          </span>
          <div className="abk-stat-copy">
            <span className="abk-stat-label">هذا الشهر</span>
            <strong className="abk-stat-value">{stats.monthCount}</strong>
          </div>
        </article>
        <article className="abk-stat">
          <span className="abk-stat-icon">
            <List size={16} strokeWidth={1.6} />
          </span>
          <div className="abk-stat-copy">
            <span className="abk-stat-label">إجمالي الحجوزات</span>
            <strong className="abk-stat-value">{stats.total}</strong>
          </div>
        </article>
      </section>

      <div className="abk-toggle">
        <button
          type="button"
          onClick={() => setViewMode("weekly")}
          className={`abk-toggle-btn${viewMode === "weekly" ? " is-active" : ""}`}
        >
          <CalendarDays size={15} strokeWidth={1.55} />
          عرض جدول أسبوعي
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`abk-toggle-btn${viewMode === "list" ? " is-active" : ""}`}
        >
          <List size={15} strokeWidth={1.55} />
          عرض قائمة
        </button>
      </div>

      <div className="abk-toolbar">
        <div className="abk-search">
          <Search size={15} strokeWidth={1.55} />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ابحث باسم العميل أو رقم الهاتف..."
            aria-label="بحث"
          />
        </div>

        <label className="abk-ctrl abk-service-ctrl">
          <Filter size={14} strokeWidth={1.55} />
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            aria-label="كل الخدمات"
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

        <label className="abk-ctrl abk-date-ctrl">
          <button
            type="button"
            aria-label="فتح التقويم"
            onClick={openDatePicker}
            className="abk-date-icon"
          >
            <CalendarDays size={14} strokeWidth={1.55} aria-hidden />
          </button>
          <span className="abk-date-display" dir="ltr">
            {dateFilter ? formatDateDisplay(dateFilter) : "dd/mm/yyyy"}
          </span>
          <input
            ref={dateInputRef}
            type="date"
            className="admin-bookings-date-input abk-date-input"
            value={dateFilter}
            onChange={(e) => applyDate(e.target.value)}
            aria-label="اختر التاريخ"
          />
        </label>

        <button
          type="button"
          onClick={viewUpcoming}
          className={`abk-btn${viewingUpcoming ? " is-active" : ""}`}
        >
          <CalendarRange size={14} strokeWidth={1.55} />
          الحجوزات القادمة
        </button>

        <button
          type="button"
          onClick={viewAllDates}
          className={`abk-btn${viewingAllDates ? " is-active" : ""}`}
        >
          <List size={14} strokeWidth={1.55} />
          عرض كل التواريخ
        </button>
      </div>

      {viewMode === "weekly" ? (
        <section className="abk-week">
          <div className="abk-week-head">
            <h2>جدول الأسبوع</h2>
            <div className="abk-week-nav">
              <button
                type="button"
                aria-label="الأسبوع السابق"
                onClick={() => shiftWeek(-1)}
                className="abk-icon-btn"
              >
                <ChevronRight size={15} strokeWidth={1.6} />
              </button>
              <span>{rangeLabelAr(weekAnchor, weekEnd)}</span>
              <button
                type="button"
                aria-label="الأسبوع التالي"
                onClick={() => shiftWeek(1)}
                className="abk-icon-btn"
              >
                <ChevronLeft size={15} strokeWidth={1.6} />
              </button>
            </div>
          </div>
          <div className="abk-week-grid">
            {weekDays.map((day) => {
              const active = day.iso === selectedDay;
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day.iso);
                    setUpcomingOnly(false);
                    onDateFilterChange(day.iso);
                  }}
                  className={`abk-week-day${active ? " is-active" : ""}`}
                >
                  <span className="abk-week-name">
                    <span className="abk-week-name-short">
                      {weekdayShortAr(day.date)}
                    </span>
                    <span className="abk-week-name-long">
                      {weekdayLongAr(day.date)}
                    </span>
                  </span>
                  <span className="abk-week-date">{dayMonthAr(day.date)}</span>
                  <span className="abk-week-count">{day.count}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="abk-results">
        <p className="abk-count">
          {viewMode === "weekly" ? (
            <>
              {visible.length} {longDayAr(selectedDay)}
            </>
          ) : viewingUpcoming ? (
            <>{visible.length} حجز — الحجوزات القادمة</>
          ) : viewingAllDates ? (
            <>{visible.length} حجز — كل التواريخ</>
          ) : (
            <>{visible.length} حجز</>
          )}
        </p>

        <section className="abk-list-shell">
          {loading ? (
            <p className="abk-empty">جارٍ التحميل…</p>
          ) : visible.length === 0 ? (
            <p className="abk-empty">لا توجد حجوزات</p>
          ) : (
            <>
              <div className="abk-table-wrap">
                <table className="abk-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الوقت</th>
                      <th>العميل</th>
                      <th>الهاتف</th>
                      <th>الخدمة</th>
                      <th>ملاحظات</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const waHref = toWhatsAppHref(row.phone);
                      return (
                        <tr
                          key={row.id}
                          className="abk-row"
                          onClick={() => onOpenRow(row)}
                        >
                          <td>
                            <span className="abk-date">
                              {formatDateDisplay(row.appointmentDate)}
                            </span>
                          </td>
                          <td>
                            <span className="abk-time" dir="ltr">
                              {formatTime24(row.appointmentTime)}
                            </span>
                          </td>
                          <td>
                            <span className="abk-cell-icon">
                              <User size={15} strokeWidth={1.5} />
                              <span className="abk-name">{row.fullName}</span>
                            </span>
                          </td>
                          <td>
                            <span className="abk-phone-cell">
                              <Phone size={14} strokeWidth={1.5} />
                              <span dir="ltr">{row.phone || "—"}</span>
                              {waHref ? (
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="abk-wa"
                                  aria-label="واتساب"
                                  title="واتساب"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <WhatsAppGlyph size={13} />
                                </a>
                              ) : null}
                            </span>
                          </td>
                          <td className="abk-service">
                            {serviceLabel(row.appointmentType || "eye_exam")}
                          </td>
                          <td className="abk-notes">
                            {row.notes?.trim() ? row.notes : "—"}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="abk-action"
                              aria-label="تعديل"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenRow(row);
                              }}
                            >
                              <SquarePen size={13} strokeWidth={1.6} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="abk-cards">
                {visible.map((row) => {
                  const waHref = toWhatsAppHref(row.phone);
                  const ReasonIcon =
                    SERVICE_ICONS[row.appointmentType || "eye_exam"] || Eye;
                  return (
                    <li key={row.id}>
                      <article
                        className="abk-card"
                        onClick={() => onOpenRow(row)}
                      >
                        <button
                          type="button"
                          className="abk-action"
                          aria-label="تعديل"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRow(row);
                          }}
                        >
                          <SquarePen size={13} strokeWidth={1.6} />
                        </button>
                        <div className="abk-card-when">
                          <span className="abk-date">
                            {formatDateDisplay(row.appointmentDate)}
                          </span>
                          <span className="abk-time" dir="ltr">
                            {formatTime24(row.appointmentTime)}
                          </span>
                        </div>
                        <div className="abk-card-client">
                          <p className="abk-card-name">
                            <User size={13} strokeWidth={1.5} />
                            <span>{row.fullName}</span>
                          </p>
                          <p className="abk-card-phone">
                            <Phone size={13} strokeWidth={1.5} />
                            <span dir="ltr">{row.phone || "—"}</span>
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="abk-wa"
                                aria-label="واتساب"
                                title="واتساب"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <WhatsAppGlyph size={13} />
                              </a>
                            ) : null}
                          </p>
                        </div>
                        <p className="abk-card-reason">
                          <ReasonIcon size={13} strokeWidth={1.5} />
                          <span>
                            {serviceLabel(row.appointmentType || "eye_exam")}
                          </span>
                        </p>
                      </article>
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
