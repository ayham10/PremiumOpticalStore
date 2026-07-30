import { NextResponse } from "next/server";
import { newId } from "@/lib/auth";
import type { ActivityLog, AppData, SmsLog } from "@/lib/types";
import type { SmsResult, SmsType } from "@/lib/sms/provider";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
  }
  console.error(error);
  return jsonError(
    error instanceof Error ? error.message : "Internal server error",
    500
  );
}

export function pushActivity(
  data: AppData,
  entry: Omit<ActivityLog, "id" | "createdAt"> & { id?: string; createdAt?: string }
) {
  data.activityLogs.unshift({
    id: entry.id || newId("act"),
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    detail: entry.detail,
    createdAt: entry.createdAt || new Date().toISOString(),
  });
  // Keep activity log bounded
  if (data.activityLogs.length > 500) {
    data.activityLogs = data.activityLogs.slice(0, 500);
  }
}

export function pushSmsLog(
  data: AppData,
  opts: {
    to: string;
    body: string;
    type: SmsType;
    result: SmsResult;
    appointmentId?: string;
  }
): SmsLog {
  const log: SmsLog = {
    id: newId("sms"),
    to: opts.to,
    body: opts.body,
    type: opts.type,
    status: opts.result.status,
    provider: opts.result.provider,
    appointmentId: opts.appointmentId,
    error: opts.result.error,
    createdAt: new Date().toISOString(),
  };
  data.smsLogs.unshift(log);
  if (data.smsLogs.length > 500) {
    data.smsLogs = data.smsLogs.slice(0, 500);
  }
  return log;
}
