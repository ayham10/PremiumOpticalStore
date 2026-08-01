import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  listAppointmentsForAdminDashboard,
  loadClinicAppointments,
} from "@/lib/db/clinic-appointments";
import { rowToAppointment } from "@/lib/db/relational-appointments";
import { getStore } from "@/lib/db/store";
import { todayInJerusalem } from "@/lib/eye-exam";
import { handleRouteError } from "@/lib/api/helpers";
import type { Appointment, AppointmentStatus, DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function jerusalemWeekDates(todayIso: string): string[] {
  const [y, m, d] = todayIso.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.getUTCDay(); // 0 Sun — matches Asia/Jerusalem calendar dates stored as ISO dates
  const start = new Date(Date.UTC(y, m - 1, d - weekday));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate(),
    ).padStart(2, "0")}`;
  });
}

export async function GET() {
  try {
    await requireSession("dashboard");
    const { data, storage } = await getStore();

    const today = todayInJerusalem();
    const weekDates = jerusalemWeekDates(today);

    let appointments: Appointment[] = [];

    try {
      const rows = await listAppointmentsForAdminDashboard();
      if (rows.length) {
        appointments = rows.map(rowToAppointment);
      }
    } catch (error) {
      console.error("Relational appointments unavailable for dashboard", error);
    }

    // Fallback / merge local filesystem clinic bookings when relational empty
    if (!appointments.length) {
      const clinic = await loadClinicAppointments();
      appointments = clinic.map((a) => ({
        id: a.id,
        service: a.appointmentType,
        staffId: "",
        customerId: "",
        customerName: `${a.firstName} ${a.lastName}`.trim(),
        customerEmail: a.email,
        customerPhone: a.phone,
        date: a.appointmentDate,
        startTime: a.appointmentTime,
        endTime: a.appointmentTime,
        status: a.status as AppointmentStatus,
        manageToken: "",
        language: a.language,
        smsStatus: a.smsStatus,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }));
    }

    // Include any legacy staff appointments from the document store that are
    // not already present in the relational list (id match).
    const seen = new Set(appointments.map((a) => a.id));
    for (const legacy of data.appointments || []) {
      if (!seen.has(legacy.id)) appointments.push(legacy);
    }

    const activeAppointments = appointments.filter(
      (a) => a.status !== "cancelled",
    );

    const todayAppointments = activeAppointments.filter((a) => a.date === today)
      .length;

    const weekAppointments = activeAppointments.filter((a) =>
      weekDates.includes(a.date),
    ).length;

    const inventoryItems = data.products.filter(
      (p) => p.status === "active" || p.status === "out_of_stock",
    ).length;

    const lowStockAlerts = data.products.filter(
      (p) =>
        (p.status === "active" || p.status === "out_of_stock") &&
        p.stockQuantity <= p.minimumStock,
    ).length;

    const recentBookings = [...appointments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8);

    const appointmentsByDay = weekDates.map((date) => ({
      date,
      count: activeAppointments.filter((a) => a.date === date).length,
    }));

    const statuses: AppointmentStatus[] = [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "rescheduled",
      "no-show",
    ];

    const statusBreakdown = statuses.map((status) => ({
      status,
      count: appointments.filter((a) => a.status === status).length,
    }));

    const todaysSchedule = appointments
      .filter((a) => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const stats: DashboardStats & {
      todaysSchedule: typeof todaysSchedule;
      recentActivity: typeof data.activityLogs;
      unreadMessages: number;
      appointmentSource: string;
    } = {
      todayAppointments,
      weekAppointments,
      inventoryItems,
      lowStockAlerts,
      totalCustomers: data.customers.length,
      recentBookings,
      appointmentsByDay,
      statusBreakdown,
      todaysSchedule,
      recentActivity: data.activityLogs.slice(0, 12),
      unreadMessages: data.contactMessages.filter((m) => !m.read).length,
      appointmentSource: "public.appointments",
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
