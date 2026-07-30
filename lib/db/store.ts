import { promises as fs } from "fs";
import path from "path";
import { createSeedData } from "@/lib/seed";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SUPABASE_TABLE = process.env.SUPABASE_STORE_TABLE || "lumina_store";
const SUPABASE_ROW_ID = process.env.SUPABASE_STORE_ID || "default";

export type StorageMode = "supabase" | "filesystem";

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secretKey
    ? { url: url.replace(/\/$/, ""), secretKey }
    : null;
}

function supabaseHeaders(config: NonNullable<ReturnType<typeof supabaseConfig>>) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function readFilesystem(): Promise<AppData | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

async function writeFilesystem(data: AppData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readSupabase(): Promise<AppData | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const url = `${config.url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(
    SUPABASE_ROW_ID
  )}&select=payload`;

  const response = await fetch(url, {
    headers: supabaseHeaders(config),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status})`);
  }

  const rows = (await response.json()) as Array<{ payload: AppData }>;
  if (!rows.length || !rows[0]?.payload) return null;
  return rows[0].payload;
}

async function writeSupabase(data: AppData): Promise<void> {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");

  const url = `${config.url}/rest/v1/${SUPABASE_TABLE}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: SUPABASE_ROW_ID,
      payload: data,
      updated_at: data.updatedAt,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase write failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }
}

function normalizeData(data: AppData): AppData {
  return {
    ...createSeedData(),
    ...data,
    products: data.products ?? [],
    appointments: data.appointments ?? [],
    customers: data.customers ?? [],
    staff: data.staff?.length ? data.staff : createSeedData().staff,
    suppliers: data.suppliers ?? [],
    promotions: data.promotions ?? [],
    media: data.media ?? [],
    reviews: data.reviews?.length ? data.reviews : createSeedData().reviews,
    contactMessages: data.contactMessages ?? [],
    smsLogs: data.smsLogs ?? [],
    activityLogs: data.activityLogs ?? [],
    holidays: data.holidays ?? [],
    availability: data.availability?.length
      ? data.availability
      : createSeedData().availability,
    settings: { ...createSeedData().settings, ...(data.settings || {}) },
    version: data.version || 1,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export async function getStore(): Promise<{ data: AppData; storage: StorageMode }> {
  const config = supabaseConfig();

  if (config) {
    try {
      const remote = await readSupabase();
      if (remote) {
        return { data: normalizeData(remote), storage: "supabase" };
      }
      const seed = createSeedData();
      await writeSupabase(seed);
      return { data: seed, storage: "supabase" };
    } catch (error) {
      console.error("Supabase store unavailable, falling back to filesystem", error);
    }
  }

  const local = await readFilesystem();
  if (local) return { data: normalizeData(local), storage: "filesystem" };

  const seed = createSeedData();
  await writeFilesystem(seed);
  return { data: seed, storage: "filesystem" };
}

export async function saveStore(data: AppData): Promise<{ storage: StorageMode }> {
  const next: AppData = {
    ...normalizeData(data),
    updatedAt: new Date().toISOString(),
  };

  const config = supabaseConfig();
  if (config) {
    try {
      await writeSupabase(next);
      // Keep local mirror for resilience
      await writeFilesystem(next).catch(() => undefined);
      return { storage: "supabase" };
    } catch (error) {
      console.error("Supabase write failed, using filesystem", error);
    }
  }

  await writeFilesystem(next);
  return { storage: "filesystem" };
}

export async function updateStore(
  mutator: (data: AppData) => AppData | Promise<AppData>
): Promise<{ data: AppData; storage: StorageMode }> {
  const { data } = await getStore();
  const next = await mutator(structuredClone(data));
  const { storage } = await saveStore(next);
  return { data: next, storage };
}
