import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getStore, updateStore } from "@/lib/db/store";
import {
  appointmentSmsBody,
  sendSms,
  type SmsType,
} from "@/lib/sms/provider";
import {
  handleRouteError,
  jsonError,
  pushActivity,
  pushSmsLog,
} from "@/lib/api/helpers";

export const dynamic = "force-dynamic";

const APPOINTMENT_TYPES = new Set<SmsType>([
  "appointment_confirmation",
  "appointment_reminder",
  "appointment_cancellation",
  "appointment_rescheduled",
  "custom",
]);

export async function GET() {
  try {
    await requireSession("sms");
    const { data } = await getStore();
    return NextResponse.json({
      logs: data.smsLogs.slice(0, 100),
      enabled: data.settings.sms.enabled,
      provider: data.settings.sms.provider,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession("sms");
    const body = (await request.json()) as {
      appointmentId?: string;
      type?: SmsType;
      to?: string;
      message?: string;
    };

    const type = body.type || "appointment_reminder";
    if (!APPOINTMENT_TYPES.has(type)) {
      return jsonError("Invalid SMS type", 400);
    }

    const { data: current } = await getStore();

    if (!current.settings.sms.enabled && type !== "custom") {
      // Still allow sending when using console/custom overrides, but warn via response
    }

    let to = body.to?.trim();
    let smsBody = body.message?.trim();
    const appointmentId = body.appointmentId;

    if (appointmentId) {
      const appointment = current.appointments.find((a) => a.id === appointmentId);
      if (!appointment) return jsonError("Appointment not found", 404);

      to = to || appointment.customerPhone;
      const staff = current.staff.find((s) => s.id === appointment.staffId);

      if (type !== "custom" || !smsBody) {
        smsBody = appointmentSmsBody(type, {
          storeName: current.settings.storeName,
          customerName: appointment.customerName,
          service: appointment.service,
          date: appointment.date,
          time: appointment.startTime,
          staffName: staff?.name,
        });
      }
    }

    if (type === "custom" && !smsBody) {
      return jsonError("Custom SMS requires a message body", 400);
    }

    if (!to || !smsBody) {
      return jsonError("Recipient and message body are required", 400);
    }

    const result = await sendSms({
      to,
      body: smsBody,
      type,
      appointmentId,
    });

    await updateStore((store) => {
      pushSmsLog(store, {
        to,
        body: smsBody!,
        type,
        result,
        appointmentId,
      });
      pushActivity(store, {
        actor: session.email,
        action: "send_sms",
        entity: "sms",
        entityId: appointmentId,
        detail: `${type} → ${to} (${result.status})`,
      });
      return store;
    });

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      provider: result.provider,
      error: result.error,
      body: smsBody,
      to,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
