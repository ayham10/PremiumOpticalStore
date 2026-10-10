import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/twilio/config";
import {
  parseFormBody,
  verifyIncomingWebhook,
} from "@/lib/twilio/webhook-signature";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetaWebhookError = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: {
    details?: string;
  };
};

type MetaWebhookStatus = {
  id?: string;
  recipient_id?: string;
  status?: string;
  timestamp?: string;
  errors?: MetaWebhookError[];
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        statuses?: MetaWebhookStatus[];
      };
    }>;
  }>;
};

function logStatusUpdate(status: MetaWebhookStatus): void {
  const primaryError = status.errors?.[0];

  if (status.status === "failed") {
    for (const error of status.errors || []) {
      console.error("[WhatsApp Webhook] delivery failed", {
        messageId: status.id || "[unknown]",
        status: status.status,
        timestamp: status.timestamp || "[unknown]",
        error: {
          code: error.code ?? null,
          title: error.title ?? null,
        },
      });
    }
  }

  console.info("[WhatsApp Webhook] message status update", {
    messageId: status.id || "[unknown]",
    status: status.status || "[unknown]",
    timestamp: status.timestamp || "[unknown]",
    errorCode: primaryError?.code ?? null,
    errorTitle: primaryError?.title ?? null,
  });
}

function processMetaPayload(payload: MetaWebhookPayload): number {
  if (payload.object !== "whatsapp_business_account") {
    console.warn("[WhatsApp Webhook] ignored unsupported payload object", {
      object: payload.object ? "present" : "missing",
    });
    return 0;
  }

  let processed = 0;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      for (const status of change.value?.statuses || []) {
        logStatusUpdate(status);
        processed += 1;
      }
    }
  }
  return processed;
}

function processTwilioForm(params: Record<string, string>): number {
  const messageId = params.MessageSid || params.SmsSid || "[unknown]";
  const status = params.MessageStatus || params.SmsStatus || "[unknown]";
  console.info("[WhatsApp Webhook] twilio status update", {
    messageId,
    status,
    errorCode: params.ErrorCode || null,
  });
  return 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expectedToken = serverEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

  if (
    mode === "subscribe" &&
    verifyToken &&
    expectedToken &&
    verifyToken === expectedToken &&
    challenge
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verification = verifyIncomingWebhook(request, rawBody);
  if (!verification.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const processed = processTwilioForm(parseFormBody(rawBody));
    return NextResponse.json({ ok: true, processed, source: verification.source });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const processed = processMetaPayload(payload);
  return NextResponse.json({ ok: true, processed, source: verification.source });
}
