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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/admin-api";
import { cn } from "@/lib/format";
import type { Appointment, Holiday, StaffMember, StoreSettings } from "@/lib/types";

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
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => new Date());
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Planning</p>
          <h1
            className="mt-1 text-3xl text-[var(--ink)]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Calendar
          </h1>
          <p className="mt-1 text-sm text-[var(--slate)]">
            Working hours & holidays respected · slot length {slotMinutes} min.
            Select an appointment, then click a day/slot to reschedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "btn !min-h-10 !px-4 !text-sm capitalize",
                view === mode ? "btn-accent" : "btn-ghost"
              )}
              onClick={() => setView(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </header>

      <div className="admin-card flex flex-wrap items-center gap-3 p-4">
        <button type="button" className="btn btn-ghost !min-h-10 !px-3" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost !min-h-10 !px-3"
          onClick={() => setCursor(new Date())}
        >
          Today
        </button>
        <button type="button" className="btn btn-ghost !min-h-10 !px-3" onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </button>
        <p className="min-w-[180px] font-semibold text-[var(--ink)]">
          {view === "month"
            ? format(cursor, "MMMM yyyy")
            : view === "week"
              ? `${format(days[0], "MMM d")} – ${format(days[days.length - 1], "MMM d, yyyy")}`
              : format(cursor, "EEEE, MMM d, yyyy")}
        </p>
        <select
          className="select ml-auto max-w-[220px]"
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
        <div className="admin-card overflow-hidden p-3">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-[var(--slate)]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                    else setCursor(day);
                  }}
                  className={cn(
                    "min-h-[96px] rounded-xl border p-2 text-left transition-colors",
                    isSameMonth(day, cursor)
                      ? "border-[var(--line)] bg-white"
                      : "border-transparent bg-[var(--mist)]/60 text-[var(--slate)]",
                    isSameDay(day, new Date()) && "ring-2 ring-[var(--accent)]",
                    isHoliday && "bg-[#fff4df]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                    <span>{format(day, "d")}</span>
                    {isHoliday ? <span className="text-[var(--warning)]">H</span> : null}
                  </div>
                  <div className="space-y-1">
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
                </button>
              );
            })}
          </div>
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
                    "border-b border-l border-[var(--line)] p-3 text-center",
                    isHoliday && "bg-[#fff4df]"
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
                      className="min-h-[52px] border-b border-l border-[var(--line)] p-1 text-left hover:bg-[var(--accent-wash)]"
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
        <h2 style={{ fontFamily: "Fraunces, serif" }} className="mb-3 text-xl">
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
