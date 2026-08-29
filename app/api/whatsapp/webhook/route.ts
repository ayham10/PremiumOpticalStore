import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/twilio/config";

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
  const errorDetails = primaryError?.error_data?.details;

  console.info("[WhatsApp Webhook] message status update", {
    messageId: status.id || "[unknown]",
    recipientId: status.recipient_id || "[unknown]",
    status: status.status || "[unknown]",
    timestamp: status.timestamp || "[unknown]",
    errorCode: primaryError?.code ?? null,
    errorTitle: primaryError?.title ?? null,
    errorMessage: primaryError?.message ?? null,
    errorDetails: errorDetails ?? null,
  });
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
  let payload: MetaWebhookPayload;

  try {
    payload = (await request.json()) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    console.warn("[WhatsApp Webhook] ignored unsupported payload object", {
      object: payload.object || "[missing]",
    });
    return NextResponse.json({ ok: true, processed: 0 });
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

  return NextResponse.json({ ok: true, processed });
}
