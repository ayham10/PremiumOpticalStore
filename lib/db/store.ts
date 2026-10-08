import { promises as fs } from "fs";
import path from "path";
import { mergeBranding } from "@/lib/branding";
import { mergeBookingMessages } from "@/lib/booking-messages";
import { mergeCategoryDefaultImages } from "@/lib/product-images";
import { normalizeLensInventory } from "@/lib/lens-inventory";
import { publicServicePages } from "@/lib/service-pages";
import { mergeSeedBookingServices } from "@/lib/booking-services";
import {
  getIsolatedStore,
  isBookingE2EIsolated,
  setIsolatedStore,
} from "@/lib/booking-e2e";
import { createSeedData } from "@/lib/seed";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const SUPABASE_TABLE = process.env.SUPABASE_STORE_TABLE || "lumina_store";
const SUPABASE_ROW_ID = process.env.SUPABASE_STORE_ID || "default";

/** Short in-process cache so public navigations don't re-hit Supabase every time. */
/** Short in-process TTL so public booking reads reuse the store blob. */
const STORE_CACHE_TTL_MS = 45_000;
let memoryStore: { at: number; data: AppData; storage: StorageMode } | null =
  null;
let storeInflight: Promise<{ data: AppData; storage: StorageMode }> | null =
  null;

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

export class StoreWriteConflictError extends Error {
  constructor() {
    super("STORE_CONFLICT");
    this.name = "StoreWriteConflictError";
  }
}

export function parseStoreVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

export function supabaseConditionalPatchPath(
  table: string,
  rowId: string,
  version: number | null,
): string {
  const id = `id=eq.${encodeURIComponent(rowId)}`;
  const cas =
    version == null
      ? "payload->>version=is.null"
      : `payload->>version=eq.${version}`;
  return `${table}?${id}&${cas}`;
}

type RemoteStoreRow = {
  payload: AppData;
  rawVersion: number | null;
};

async function readSupabase(): Promise<RemoteStoreRow | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const url = `${config.url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(
    SUPABASE_ROW_ID
  )}&select=payload,updated_at`;

  const response = await fetch(url, {
    headers: supabaseHeaders(config),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status})`);
  }

  const rows = (await response.json()) as Array<{
    payload: AppData;
    updated_at?: string | null;
  }>;
  if (!rows.length || !rows[0]?.payload) return null;
  return {
    payload: rows[0].payload,
    rawVersion: parseStoreVersion(rows[0].payload.version),
  };
}

async function writeSupabase(
  data: AppData,
  opts?: { ifVersion?: number | null },
): Promise<void> {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase is not configured");

  const body = JSON.stringify({
    id: SUPABASE_ROW_ID,
    payload: data,
    updated_at: data.updatedAt,
  });

  if (opts && "ifVersion" in opts) {
    const url = `${config.url}/rest/v1/${supabaseConditionalPatchPath(
      SUPABASE_TABLE,
      SUPABASE_ROW_ID,
      opts.ifVersion ?? null,
    )}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(config),
        Prefer: "return=representation",
      },
      body,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Supabase write failed (${response.status})${detail ? `: ${detail}` : ""}`
      );
    }
    const rows = (await response.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new StoreWriteConflictError();
    }
    return;
  }

  const url = `${config.url}/rest/v1/${SUPABASE_TABLE}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Supabase write failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }
}

function mergeMissingSeedProducts(existing: AppData["products"]) {
  const seedProducts = createSeedData().products;
  const byId = new Set(existing.map((p) => p.id));
  const bySlug = new Set(existing.map((p) => p.slug));
  const missing = seedProducts.filter(
    (p) => !byId.has(p.id) && !bySlug.has(p.slug),
  );
  return missing.length ? [...existing, ...missing] : existing;
}

function normalizeData(data: AppData): AppData {
  const products = mergeMissingSeedProducts(data.products ?? []);
  const eyeExamAppointments = (data.eyeExamAppointments ?? []).map((a) => {
    const type = a.appointmentType;
    const appointmentType =
      typeof type === "string" && type.trim()
        ? type.trim()
        : ("eye_exam" as const);
    return { ...a, appointmentType };
  });
  const bookingServices = mergeSeedBookingServices(data.bookingServices);
  return {
    ...createSeedData(),
    ...data,
    products,
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
    eyeExamAvailability: data.eyeExamAvailability?.length
      ? data.eyeExamAvailability
      : createSeedData().eyeExamAvailability,
    eyeExamAppointments,
    previewManageTestAppointments: (data.previewManageTestAppointments || []).slice(
      0,
      5,
    ),
    bookingServices,
    lensInventory: normalizeLensInventory(data.lensInventory),
    settings: {
      ...createSeedData().settings,
      ...(data.settings || {}),
      branding: mergeBranding(data.settings?.branding),
      bookingMessages: mergeBookingMessages(data.settings?.bookingMessages),
      categoryDefaultImages: mergeCategoryDefaultImages(
        data.settings?.categoryDefaultImages,
      ),
      servicePages: publicServicePages(data.settings?.servicePages),
    },
    version: data.version || 1,
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export async function getStore(opts?: {
  bypassCache?: boolean;
}): Promise<{ data: AppData; storage: StorageMode }> {
  if (isBookingE2EIsolated()) {
    const isolated = getIsolatedStore();
    if (isolated) return { data: isolated, storage: "filesystem" };
  }
  const now = Date.now();
  if (
    !opts?.bypassCache &&
    memoryStore &&
    now - memoryStore.at < STORE_CACHE_TTL_MS &&
    !storeInflight
  ) {
    return { data: memoryStore.data, storage: memoryStore.storage };
  }
  if (!opts?.bypassCache && storeInflight) return storeInflight;

  storeInflight = (async () => {
    const result = await readStoreUncached();
    memoryStore = {
      at: Date.now(),
      data: result.data,
      storage: result.storage,
    };
    return result;
  })();

  try {
    return await storeInflight;
  } finally {
    storeInflight = null;
  }
}

async function readStoreUncached(): Promise<{
  data: AppData;
  storage: StorageMode;
  rawVersion?: number | null;
}> {
  const config = supabaseConfig();

  if (config) {
    try {
      const remote = await readSupabase();
      if (remote) {
        return {
          data: normalizeData(remote.payload),
          storage: "supabase",
          rawVersion: remote.rawVersion,
        };
      }
      const seed = createSeedData();
      seed.promotions = [];
      await writeSupabase(seed);
      return { data: seed, storage: "supabase", rawVersion: seed.version };
    } catch (error) {
      console.error("Supabase store unavailable, falling back to filesystem", error);
    }
  }

  const local = await readFilesystem();
  if (local) return { data: normalizeData(local), storage: "filesystem" };

  // On Vercel the filesystem is read-only outside /tmp. Return seeded data
  // even when we cannot persist the local JSON mirror.
  const seed = createSeedData();
  try {
    await writeFilesystem(seed);
  } catch (error) {
    console.warn("Filesystem store seed skipped (read-only runtime)", error);
  }
  return { data: seed, storage: "filesystem" };
}

export function invalidateStoreCache() {
  memoryStore = null;
}

/**
 * Restore-only write. Replaces the live payload as-is.
 * Does not seed-merge, normalize, or touch lumina-media.
 */
export async function replaceStorePayload(data: AppData): Promise<void> {
  if (!data || typeof data !== "object" || !Array.isArray(data.products)) {
    throw new Error("Invalid store payload");
  }
  const next: AppData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const config = supabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured; restore aborted");
  }
  await writeSupabase(next);
  await writeFilesystem(next).catch(() => undefined);
  memoryStore = { at: Date.now(), data: next, storage: "supabase" };
}

export async function saveStore(
  data: AppData,
  opts?: { ifVersion?: number | null },
): Promise<{ storage: StorageMode }> {
  const normalized = normalizeData(data);
  const next: AppData = {
    ...normalized,
    version:
      opts && "ifVersion" in opts
        ? (opts.ifVersion ?? 0) + 1
        : normalized.version || 1,
    updatedAt: new Date().toISOString(),
  };

  const config = supabaseConfig();
  if (config) {
    try {
      await writeSupabase(next, opts);
      // Keep local mirror for resilience
      await writeFilesystem(next).catch(() => undefined);
      memoryStore = { at: Date.now(), data: next, storage: "supabase" };
      return { storage: "supabase" };
    } catch (error) {
      if (error instanceof StoreWriteConflictError) throw error;
      console.error("Supabase write failed, using filesystem", error);
    }
  }

  try {
    await writeFilesystem(next);
    memoryStore = { at: Date.now(), data: next, storage: "filesystem" };
    return { storage: "filesystem" };
  } catch (error) {
    invalidateStoreCache();
    // Serverless/read-only runtimes cannot persist local JSON. Prefer failing
    // the mutation clearly rather than crashing with an opaque FS error.
    throw new Error(
      `Unable to persist store (filesystem unavailable). Configure Supabase for production. ${
        error instanceof Error ? error.message : ""
      }`.trim()
    );
  }
}

const STORE_CONFLICT_RETRIES = 4;

export async function updateStore(
  mutator: (data: AppData) => AppData | Promise<AppData>,
): Promise<{ data: AppData; storage: StorageMode }> {
  if (isBookingE2EIsolated()) {
    const isolated = getIsolatedStore();
    if (isolated) {
      const next = await mutator(structuredClone(isolated));
      setIsolatedStore(next);
      return { data: next, storage: "filesystem" };
    }
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= STORE_CONFLICT_RETRIES; attempt++) {
    const { data, storage, rawVersion } = await readStoreUncached();
    const next = await mutator(structuredClone(data));
    try {
      const saved = await saveStore(
        next,
        storage === "supabase" ? { ifVersion: rawVersion ?? null } : undefined,
      );
      return { data: next, storage: saved.storage };
    } catch (error) {
      lastError = error;
      if (!(error instanceof StoreWriteConflictError)) throw error;
      invalidateStoreCache();
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new StoreWriteConflictError();
}
