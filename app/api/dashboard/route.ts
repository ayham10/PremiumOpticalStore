import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { handleRouteError } from "@/lib/api/helpers";
import {
  formatEyeExamDateDisplay,
  isValidIsoDate,
  normalizeAppointmentType,
  todayInJerusalem,
} from "@/lib/eye-exam";
import type {
  DashboardRecentBooking,
  DashboardStats,
  EyeExamAppointment,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/** Normalize stored ISO (YYYY-MM-DD) or display DD/MM/YY into ISO. */
function toIsoDate(value: string): string {
  const raw = (value || "").trim();
  if (isValidIsoDate(raw)) return raw;
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return raw;
  const day = match[1];
  const month = match[2];
  const year =
    match[3].length === 2 ? `20${match[3]}` : match[3];
  const iso = `${year}-${month}-${day}`;
  return isValidIsoDate(iso) ? iso : raw;
}

/** Sunday-start week dates in Asia/Jerusalem calendar (from ISO today). */
function jerusalemWeekDates(todayIso: string): string[] {
  const [y, m, d] = todayIso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.getUTCDay(); // 0 = Sunday
  const start = new Date(Date.UTC(y, m - 1, d - weekday));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate(),
    ).padStart(2, "0")}`;
  });
}

function toRecentBooking(a: EyeExamAppointment): DashboardRecentBooking {
  const date = toIsoDate(a.appointmentDate);
  const appointmentType = normalizeAppointmentType(a.appointmentType);
  return {
    id: a.id,
    customerName: `${a.firstName} ${a.lastName}`.trim(),
    customerEmail: a.email,
    customerPhone: a.phone,
    service: appointmentType,
    appointmentType,
    date,
    dateLabel: formatEyeExamDateDisplay(date),
    startTime: (a.appointmentTime || "").slice(0, 5),
    status: a.status,
    createdAt: a.createdAt,
  };
}

/**
 * Same clinic appointments source as Clinic Bookings → Appointments:
 * lumina_store.payload.eyeExamAppointments (via getStore).
 */
export async function GET() {
  try {
    await requireSession("dashboard");
    const { data, storage } = await getStore();

    // Exact same array Clinic Bookings appointments tab reads
    const clinicAppointments = [...(data.eyeExamAppointments || [])];

    const today = todayInJerusalem();
    const weekDates = jerusalemWeekDates(today);

    const normalized = clinicAppointments.map((a) => ({
      ...a,
      appointmentDate: toIsoDate(a.appointmentDate),
      appointmentType: normalizeAppointmentType(a.appointmentType),
      appointmentTime: (a.appointmentTime || "").slice(0, 5),
    }));

    const activeAppointments = normalized.filter(
      (a) => a.status !== "cancelled",
    );

    const todayAppointments = activeAppointments.filter(
      (a) => a.appointmentDate === today,
    ).length;

    const weekAppointments = activeAppointments.filter((a) =>
      weekDates.includes(a.appointmentDate),
    ).length;

    const inventoryItems = data.products.filter(
      (p) => p.status === "active" || p.status === "out_of_stock",
    ).length;

    const lowStockAlerts = data.products.filter(
      (p) =>
        (p.status === "active" || p.status === "out_of_stock") &&
        p.stockQuantity <= p.minimumStock,
    ).length;

    // Unique customers from clinic bookings (email, fallback phone)
    const customerKeys = new Set(
      normalized.map((a) => {
        const email = (a.email || "").trim().toLowerCase();
        if (email) return `e:${email}`;
        return `p:${(a.phone || "").trim()}`;
      }).filter((k) => k !== "e:" && k !== "p:"),
    );

    const recentBookings = [...normalized]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map(toRecentBooking);

    const appointmentsByDay = weekDates.map((date) => ({
      date,
      dateLabel: formatEyeExamDateDisplay(date),
      count: activeAppointments.filter((a) => a.appointmentDate === date).length,
    }));

    const statuses = [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "rescheduled",
      "no-show",
    ] as const;

    const statusBreakdown = statuses.map((status) => ({
      status,
      count: normalized.filter((a) => a.status === status).length,
    }));

    const todaysSchedule = activeAppointments
      .filter((a) => a.appointmentDate === today)
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
      .map(toRecentBooking);

    const stats: DashboardStats & {
      todaysSchedule: DashboardRecentBooking[];
      recentActivity: typeof data.activityLogs;
      unreadMessages: number;
      appointmentSource: string;
      timezone: string;
    } = {
      todayAppointments,
      weekAppointments,
      inventoryItems,
      lowStockAlerts,
      totalCustomers: customerKeys.size,
      recentBookings,
      appointmentsByDay,
      statusBreakdown,
      todaysSchedule,
      recentActivity: data.activityLogs.slice(0, 12),
      unreadMessages: data.contactMessages.filter((m) => !m.read).length,
      appointmentSource: "eyeExamAppointments",
      timezone: "Asia/Jerusalem",
    };

    return NextResponse.json({
      stats,
      staff: data.staff.filter((s) => s.active),
      storage,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
