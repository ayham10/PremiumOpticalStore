import type { EyeExamAppointment } from "@/lib/types";
import { capPreviewManageTestAppointments } from "@/lib/booking-manage-test";

export const DEFAULT_BOOKING_MANAGE_TEST_STORE_ID =
  "preview_booking_manage_test";
export const BOOKING_MANAGE_TEST_KIND = "oyon_booking_manage_preview_tests";

export type PreviewTestStoreConfig = {
  url: string;
  secretKey: string;
  table: string;
  storeId: string;
  dedicatedProject: boolean;
};

export type PreviewTestStoreConfigResult =
  | { ok: true; config: PreviewTestStoreConfig }
  | { ok: false; error: string; missing: string[] };

export function resolvePreviewTestStoreConfig(
  env: Record<string, string | undefined> = process.env,
): PreviewTestStoreConfigResult {
  const productionStoreId =
    (env.SUPABASE_STORE_ID || "default").trim() || "default";
  const storeId = (
    env.BOOKING_MANAGE_TEST_STORE_ID || DEFAULT_BOOKING_MANAGE_TEST_STORE_ID
  ).trim();

  if (!storeId || storeId === "default" || storeId === productionStoreId) {
    return {
      ok: false,
      error: `BOOKING_MANAGE_TEST_STORE_ID must be a dedicated row, not "${productionStoreId}". Use ${DEFAULT_BOOKING_MANAGE_TEST_STORE_ID}.`,
      missing: ["BOOKING_MANAGE_TEST_STORE_ID"],
    };
  }

  const dedicatedUrl = (env.BOOKING_MANAGE_TEST_SUPABASE_URL || "").trim();
  const dedicatedKey = (env.BOOKING_MANAGE_TEST_SUPABASE_SECRET_KEY || "").trim();
  const url = (
    dedicatedUrl ||
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const secretKey = (
    dedicatedKey ||
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  const table = (
    env.BOOKING_MANAGE_TEST_STORE_TABLE ||
    env.SUPABASE_STORE_TABLE ||
    "lumina_store"
  ).trim();

  const missing: string[] = [];
  if (!url) {
    missing.push("BOOKING_MANAGE_TEST_SUPABASE_URL or SUPABASE_URL");
  }
  if (!secretKey) {
    missing.push("BOOKING_MANAGE_TEST_SUPABASE_SECRET_KEY or SUPABASE_SECRET_KEY");
  }
  if (missing.length) {
    return {
      ok: false,
      error:
        "Preview booking-manage test storage is not configured. Vercel Preview cannot use the local filesystem. Set the missing variables on this Preview environment, and store fixtures in a dedicated lumina_store row (preview_booking_manage_test), never the live customer row (default).",
      missing,
    };
  }

  return {
    ok: true,
    config: {
      url,
      secretKey,
      table,
      storeId,
      dedicatedProject: Boolean(dedicatedUrl && dedicatedKey),
    },
  };
}

export function publicPreviewTestStoreStatus(
  result: PreviewTestStoreConfigResult = resolvePreviewTestStoreConfig(),
) {
  if (!result.ok) {
    return {
      storageReady: false as const,
      storeId: DEFAULT_BOOKING_MANAGE_TEST_STORE_ID,
      dedicatedProject: false,
      missing: result.missing,
      error: result.error,
    };
  }
  return {
    storageReady: true as const,
    storeId: result.config.storeId,
    table: result.config.table,
    dedicatedProject: result.config.dedicatedProject,
    missing: [] as string[],
  };
}

type PreviewTestPayload = {
  kind: typeof BOOKING_MANAGE_TEST_KIND;
  appointments: EyeExamAppointment[];
  updatedAt: string;
};

function headers(config: PreviewTestStoreConfig) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export function parsePreviewTestPayload(raw: unknown): EyeExamAppointment[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.products) && Array.isArray(obj.eyeExamAppointments)) {
    throw new Error(
      "Refusing to use the live customer store payload for Preview tests.",
    );
  }
  if (
    obj.kind === BOOKING_MANAGE_TEST_KIND &&
    Array.isArray(obj.appointments)
  ) {
    return obj.appointments as EyeExamAppointment[];
  }
  return [];
}

let testStoreLock: Promise<void> = Promise.resolve();

export async function withPreviewTestStoreLock<T>(
  fn: () => Promise<T>,
): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = testStoreLock;
  testStoreLock = previous.then(() => gate);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function readPreviewTestAppointments(): Promise<
  EyeExamAppointment[]
> {
  const resolved = resolvePreviewTestStoreConfig();
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  const { config } = resolved;
  const url = `${config.url}/rest/v1/${config.table}?id=eq.${encodeURIComponent(
    config.storeId,
  )}&select=payload`;
  const response = await fetch(url, {
    headers: headers(config),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Preview test store read failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`,
    );
  }
  const rows = (await response.json()) as Array<{ payload?: unknown }>;
  if (!rows.length || !rows[0]?.payload) return [];
  return parsePreviewTestPayload(rows[0].payload);
}

export async function writePreviewTestAppointments(
  appointments: EyeExamAppointment[],
): Promise<void> {
  const resolved = resolvePreviewTestStoreConfig();
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }
  const { config } = resolved;
  const updatedAt = new Date().toISOString();
  const payload: PreviewTestPayload = {
    kind: BOOKING_MANAGE_TEST_KIND,
    appointments: capPreviewManageTestAppointments(appointments),
    updatedAt,
  };
  const url = `${config.url}/rest/v1/${config.table}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers(config),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: config.storeId,
      payload,
      updated_at: updatedAt,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Preview test store write failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}. This path never uses the local filesystem.`,
    );
  }
}
