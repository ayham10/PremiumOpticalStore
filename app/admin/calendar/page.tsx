"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/format";
import type { Appointment, Holiday, StaffMember, StoreSettings } from "@/lib/types";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type ViewMode = "day" | "week" | "month";

function unwrapList<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

function toYmd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function AdminCalendarPage() {
  const [view, setView] = useState<ViewMode>("day");
  const [cursor, setCursor] = useState(() => new Date());
  const [isNarrow, setIsNarrow] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [staffFilter, setStaffFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aData, dashData, setData, staffData] = await Promise.all([
        apiFetch<unknown>("/api/appointments"),
        apiFetch<{
          stats?: unknown;
          staff?: StaffMember[];
        }>("/api/dashboard").catch(() => null),
        apiFetch<StoreSettings | { settings: StoreSettings }>(
          "/api/settings?admin=1"
        ).catch(() =>
          apiFetch<StoreSettings | { settings: StoreSettings }>("/api/settings")
        ),
        apiFetch<{ staff?: StaffMember[]; holidays?: Holiday[] }>(
          "/api/staff"
        ).catch(() => null),
      ]);
      setAppointments(unwrapList<Appointment>(aData, ["appointments", "items", "data"]));
      const fromStaffApi = unwrapList<StaffMember>(staffData, ["staff"]);
      setStaff(
        fromStaffApi.length
          ? fromStaffApi
          : unwrapList<StaffMember>(dashData, ["staff"])
      );
      if (staffData?.holidays) setHolidays(staffData.holidays);
      if (setData) {
        const settingsObj =
          setData && typeof setData === "object" && "settings" in setData
            ? (setData as { settings: StoreSettings }).settings
            : (setData as StoreSettings);
        setSettings(settingsObj);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsNarrow(mq.matches);
      if (mq.matches) {
        setView((v) => (v === "week" ? "day" : v));
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const staffMap = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s])),
    [staff]
  );

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end: addDays(start, 6) });
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor, view]);

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => h.date)),
    [holidays]
  );

  const filtered = useMemo(() => {
    return appointments.filter((a) =>
      staffFilter === "all" ? true : a.staffId === staffFilter
    );
  }, [appointments, staffFilter]);

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const list = map.get(a.date) || [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => x.startTime.localeCompare(y.startTime));
    }
    return map;
  }, [filtered]);

  const selected = filtered.find((a) => a.id === selectedId) || null;
  const slotMinutes = settings?.appointmentSlotMinutes || 30;

  async function rescheduleTo(date: string, startTime?: string) {
    if (!selected) {
      setMessage("Select an appointment first, then click a slot to reschedule.");
      return;
    }
    setMessage("");
    try {
      const body: Record<string, string> = { date, status: "rescheduled" };
      if (startTime) body.startTime = startTime;
      const updated = await apiFetch<Appointment | { appointment: Appointment }>(
        "/api/appointments",
        { method: "PATCH", body: JSON.stringify({ id: selected.id, ...body }) }
      );
      const row =
        updated && typeof updated === "object" && "appointment" in updated
          ? updated.appointment
          : (updated as Appointment);
      setAppointments((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, ...row } : a))
      );
      setMessage(
        `Moved ${selected.customerName} to ${date}${startTime ? ` ${startTime}` : ""}`
      );
      setSelectedId(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Reschedule failed");
    }
  }

  function shift(dir: -1 | 1) {
    if (view === "day") setCursor((d) => addDays(d, dir));
    else if (view === "week") setCursor((d) => addDays(d, dir * 7));
    else setCursor((d) => (dir > 0 ? addMonths(d, 1) : subMonths(d, 1)));
  }

  const daySlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 9; h < 19; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  }, [slotMinutes]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        icon={CalendarDays}
        kicker="Planning"
        title="Calendar"
        description={`Working hours & holidays respected · slot length ${slotMinutes} min. Select an appointment, then tap a day/slot to reschedule.`}
        actions={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {(["day", "week", "month"] as ViewMode[])
            .filter((mode) => !(isNarrow && mode === "week"))
            .map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "btn !min-h-11 flex-1 !px-4 !text-sm capitalize sm:flex-none",
                  view === mode ? "btn-accent" : "btn-ghost"
                )}
                onClick={() => setView(mode)}
              >
                {mode}
              </button>
            ))}
        </div>
        }
      />

      <div className="admin-card flex flex-wrap items-center gap-2 p-3 sm:gap-3 sm:p-4">
        <button type="button" className="btn btn-ghost !min-h-11 !px-3" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost !min-h-11 !px-3"
          onClick={() => setCursor(new Date())}
        >
          Today
        </button>
        <button type="button" className="btn btn-ghost !min-h-11 !px-3" onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </button>
        <p className="w-full font-semibold text-[var(--ink)] sm:w-auto sm:min-w-[180px]">
          {view === "month"
            ? format(cursor, "MMMM yyyy")
            : view === "week"
              ? `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`
              : format(cursor, "EEEE, MMM d, yyyy")}
        </p>
        <select
          className="select w-full sm:ms-auto sm:max-w-[220px]"
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
        >
          <option value="all">All staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <p className="rounded-xl border border-[var(--accent)] bg-[var(--accent-wash)] px-3 py-2 text-sm text-[var(--accent)]">
          Selected: <strong>{selected.customerName}</strong> ({selected.service}). Click a
          day or time slot to move.
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setSelectedId(null)}
          >
            Clear
          </button>
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl bg-[var(--mist)] px-3 py-2 text-sm text-[var(--ink-soft)]">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[var(--slate)]">Loading calendar…</p>
      ) : view === "month" ? (
        <div className="admin-card overflow-hidden p-2 sm:p-3">
          <div className="mb-2 grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--slate)] sm:gap-1 sm:text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1.5 sm:py-2">
                <span className="sm:hidden">{d.slice(0, 1)}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {days.map((day) => {
              const key = toYmd(day);
              const list = byDate.get(key) || [];
              const isHoliday = holidaySet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (selected) void rescheduleTo(key);
                    else {
                      setCursor(day);
                      if (isNarrow) setView("day");
                    }
                  }}
                  className={cn(
                    "min-h-[64px] rounded-lg border p-1 text-left transition-colors sm:min-h-[96px] sm:rounded-xl sm:p-2",
                    isSameMonth(day, cursor)
                      ? "border-[var(--line)] bg-[var(--admin-card,#13191E)]"
                      : "border-transparent bg-[var(--mist)]/60 text-[var(--slate)]",
                    isSameDay(day, new Date()) && "ring-2 ring-[var(--accent)]",
                    isHoliday && "bg-[rgba(212,175,106,0.12)]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-[0.7rem] font-semibold sm:text-xs">
                    <span>{format(day, "d")}</span>
                    {isHoliday ? <span className="text-[var(--warning)]">H</span> : null}
                  </div>
                  <div className="hidden space-y-1 sm:block">
                    {list.slice(0, 3).map((a) => {
                      const color = staffMap[a.staffId]?.color || "#1a4a6b";
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white",
                            selectedId === a.id && "ring-2 ring-offset-1 ring-[var(--ink)]"
                          )}
                          style={{ background: color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(a.id);
                          }}
                        >
                          {a.startTime} {a.customerName}
                        </div>
                      );
                    })}
                    {list.length > 3 ? (
                      <p className="text-[10px] text-[var(--slate)]">+{list.length - 3} more</p>
                    ) : null}
                  </div>
                  {list.length > 0 ? (
                    <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                      {list.slice(0, 3).map((a) => (
                        <span
                          key={a.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: staffMap[a.staffId]?.color || "#1a4a6b" }}
                        />
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : isNarrow || view === "day" ? (
        <div className="space-y-3">
          {(isNarrow && view !== "day" ? [cursor] : days).map((day) => {
            const key = toYmd(day);
            const list = byDate.get(key) || [];
            const isHoliday = holidaySet.has(key);
            return (
              <div key={key} className="admin-card overflow-hidden">
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3",
                    isHoliday && "bg-[rgba(212,175,106,0.12)]"
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--slate)]">
                      {format(day, "EEEE")}
                    </p>
                    <p className="font-semibold text-[var(--ink)]">{format(day, "MMM d, yyyy")}</p>
                  </div>
                  {isHoliday ? (
                    <span className="text-xs font-semibold text-[var(--warning)]">Holiday</span>
                  ) : null}
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {daySlots.map((slot) => {
                    const slotAppts = list.filter((a) => a.startTime === slot);
                    return (
                      <button
                        key={`${key}-${slot}`}
                        type="button"
                        className="flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--accent-wash)]"
                        onClick={() => {
                          if (selected) void rescheduleTo(key, slot);
                        }}
                      >
                        <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold text-[var(--slate)]">
                          {slot}
                        </span>
                        <span className="min-w-0 flex-1 space-y-1.5">
                          {slotAppts.length === 0 ? (
                            <span className="block text-xs text-[var(--slate)]/70">
                              {selected ? "Tap to move here" : "Open"}
                            </span>
                          ) : (
                            slotAppts.map((a) => {
                              const color = staffMap[a.staffId]?.color || "#1a4a6b";
                              return (
                                <span
                                  key={a.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(a.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") setSelectedId(a.id);
                                  }}
                                  className={cn(
                                    "block rounded-xl px-3 py-2 text-sm font-semibold text-white",
                                    selectedId === a.id && "ring-2 ring-[var(--ink)] ring-offset-1"
                                  )}
                                  style={{ background: color }}
                                >
                                  <span className="block truncate">{a.customerName}</span>
                                  <span className="block truncate text-xs font-medium opacity-90">
                                    {a.service}
                                  </span>
                                </span>
                              );
                            })
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="admin-card overflow-x-auto">
          <div
            className="grid min-w-[720px]"
            style={{
              gridTemplateColumns: `80px repeat(${days.length}, minmax(120px, 1fr))`,
            }}
          >
            <div className="border-b border-[var(--line)] p-3 text-xs font-semibold uppercase text-[var(--slate)]">
              Time
            </div>
            {days.map((day) => {
              const key = toYmd(day);
              const isHoliday = holidaySet.has(key);
              return (
                <div
                  key={key}
                  className={cn(
                    "border-b border-s border-[var(--line)] p-3 text-center",
                    isHoliday && "bg-[rgba(212,175,106,0.12)]"
                  )}
                >
                  <p className="text-xs font-semibold uppercase text-[var(--slate)]">
                    {format(day, "EEE")}
                  </p>
                  <p className="font-semibold text-[var(--ink)]">{format(day, "MMM d")}</p>
                  {isHoliday ? (
                    <p className="text-[10px] text-[var(--warning)]">Holiday</p>
                  ) : null}
                </div>
              );
            })}

            {daySlots.map((slot) => (
              <div key={slot} className="contents">
                <div className="border-b border-[var(--line)] px-2 py-3 text-xs text-[var(--slate)]">
                  {slot}
                </div>
                {days.map((day) => {
                  const key = toYmd(day);
                  const list = (byDate.get(key) || []).filter((a) => a.startTime === slot);
                  return (
                    <button
                      key={`${key}-${slot}`}
                      type="button"
                      className="min-h-[52px] border-b border-s border-[var(--line)] p-1 text-left hover:bg-[var(--accent-wash)]"
                      onClick={() => {
                        if (selected) void rescheduleTo(key, slot);
                      }}
                    >
                      {list.map((a) => {
                        const color = staffMap[a.staffId]?.color || "#1a4a6b";
                        return (
                          <div
                            key={a.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(a.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") setSelectedId(a.id);
                            }}
                            className={cn(
                              "mb-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white",
                              selectedId === a.id && "ring-2 ring-[var(--ink)] ring-offset-1"
                            )}
                            style={{ background: color }}
                          >
                            <div className="truncate">{a.customerName}</div>
                            <div className="truncate opacity-90">{a.service}</div>
                          </div>
                        );
                      })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="admin-card p-5">
        <h2 className="mb-3 text-xl">
          Staff legend
        </h2>
        <div className="flex flex-wrap gap-3">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: s.color }}
              />
              {s.name}
            </div>
          ))}
        </div>
        {settings?.openingHours ? (
          <p className="mt-4 text-sm text-[var(--slate)]">
            Typical hours:{" "}
            {settings.openingHours
              .filter((h) => !h.closed)
              .slice(0, 1)
              .map((h) => `${h.open}–${h.close}`)
              .join("") || "see Settings"}
            . Closed days and holidays block public booking.
          </p>
        ) : null}
      </section>
    </div>
  );
}
