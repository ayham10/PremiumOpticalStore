import type { SmsLog } from "@/lib/types";

export type SmsType = SmsLog["type"];

export interface SmsPayload {
  to: string;
  body: string;
  type: SmsType;
  appointmentId?: string;
}

export interface SmsResult {
  ok: boolean;
  provider: string;
  status: SmsLog["status"];
  error?: string;
  externalId?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

async function sendTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER || process.env.SMS_FROM_NUMBER;

  if (!sid || !token || !from) {
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      error: "Twilio credentials are not configured",
    };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "twilio",
      status: "failed",
      error: detail || `Twilio error ${response.status}`,
    };
  }

  const json = (await response.json()) as { sid?: string };
  return {
    ok: true,
    provider: "twilio",
    status: "sent",
    externalId: json.sid,
  };
}

async function sendMessageBird(to: string, body: string): Promise<SmsResult> {
  const key = process.env.MESSAGEBIRD_API_KEY;
  const from = process.env.MESSAGEBIRD_ORIGINATOR || process.env.SMS_FROM_NUMBER;

  if (!key || !from) {
    return {
      ok: false,
      provider: "messagebird",
      status: "failed",
      error: "MessageBird credentials are not configured",
    };
  }

  const response = await fetch("https://rest.messagebird.com/messages", {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originator: from,
      recipients: [to],
      body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "messagebird",
      status: "failed",
      error: detail || `MessageBird error ${response.status}`,
    };
  }

  const json = (await response.json()) as { id?: string };
  return {
    ok: true,
    provider: "messagebird",
    status: "sent",
    externalId: json.id,
  };
}

async function sendCustom(to: string, body: string): Promise<SmsResult> {
  const endpoint = process.env.SMS_CUSTOM_ENDPOINT;
  const apiKey = process.env.SMS_CUSTOM_API_KEY;

  if (!endpoint) {
    return {
      ok: false,
      provider: "custom",
      status: "failed",
      error: "SMS_CUSTOM_ENDPOINT is not configured",
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ to, body }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      provider: "custom",
      status: "failed",
      error: detail || `Custom SMS error ${response.status}`,
    };
  }

  return { ok: true, provider: "custom", status: "sent" };
}

export function getSmsProviderName(): string {
  return (
    process.env.SMS_PROVIDER ||
    process.env.NEXT_PUBLIC_SMS_PROVIDER ||
    "console"
  ).toLowerCase();
}

export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const to = normalizePhone(payload.to);
  const provider = getSmsProviderName();

  if (!to) {
    return {
      ok: false,
      provider,
      status: "failed",
      error: "Invalid phone number",
    };
  }

  try {
    if (provider === "twilio") return sendTwilio(to, payload.body);
    if (provider === "messagebird") return sendMessageBird(to, payload.body);
    if (provider === "custom") return sendCustom(to, payload.body);

    console.info(`[SMS:${provider}] to=${to} type=${payload.type} :: ${payload.body}`);
    return { ok: true, provider: "console", status: "simulated" };
  } catch (error) {
    return {
      ok: false,
      provider,
      status: "failed",
      error: error instanceof Error ? error.message : "SMS send failed",
    };
  }
}

export function appointmentSmsBody(
  type: SmsType,
  opts: {
    storeName: string;
    customerName: string;
    service: string;
    date: string;
    time: string;
    staffName?: string;
  }
): string {
  const when = `${opts.date} at ${opts.time}`;
  const withStaff = opts.staffName ? ` with ${opts.staffName}` : "";

  switch (type) {
    case "appointment_confirmation":
      return `${opts.storeName}: Hi ${opts.customerName}, your ${opts.service} is confirmed for ${when}${withStaff}. Reply if you need to reschedule.`;
    case "appointment_reminder":
      return `${opts.storeName}: Reminder — ${opts.service} on ${when}${withStaff}. We look forward to seeing you.`;
    case "appointment_cancellation":
      return `${opts.storeName}: Your ${opts.service} on ${when} has been cancelled. Book again anytime.`;
    case "appointment_rescheduled":
      return `${opts.storeName}: Your appointment was rescheduled to ${when}${withStaff}.`;
    default:
      return `${opts.storeName}: Update regarding your appointment on ${when}.`;
  }
}
