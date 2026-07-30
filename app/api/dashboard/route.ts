import { NextResponse } from "next/server";
import { addDays, format, startOfWeek } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { handleRouteError } from "@/lib/api/helpers";
import type { AppointmentStatus, DashboardStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession("dashboard");
    const { data, storage } = await getStore();

    const today = format(new Date(), "yyyy-MM-dd");
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), "yyyy-MM-dd")
    );

    const activeAppointments = data.appointments.filter(
      (a) => a.status !== "cancelled"
    );

    const todayAppointments = activeAppointments.filter((a) => a.date === today)
      .length;

    const weekAppointments = activeAppointments.filter((a) =>
      weekDates.includes(a.date)
    ).length;

    const inventoryItems = data.products.filter(
      (p) => p.status === "active" || p.status === "out_of_stock"
    ).length;

    const lowStockAlerts = data.products.filter(
      (p) =>
        (p.status === "active" || p.status === "out_of_stock") &&
        p.stockQuantity <= p.minimumStock
    ).length;

    const recentBookings = [...data.appointments]
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
    ];

    const statusBreakdown = statuses.map((status) => ({
      status,
      count: data.appointments.filter((a) => a.status === status).length,
    }));

    const todaysSchedule = data.appointments
      .filter((a) => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const stats: DashboardStats & {
      todaysSchedule: typeof todaysSchedule;
      recentActivity: typeof data.activityLogs;
      unreadMessages: number;
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
