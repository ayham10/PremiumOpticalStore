import {
  createPreRestoreSnapshot,
  loadRestorableSnapshot,
  readLiveStoreRow,
  type OyonStoreSnapshot,
} from "@/lib/backup";
import { invalidateStoreCache, replaceStorePayload } from "@/lib/db/store";
import type { AppData } from "@/lib/types";
import {
  applyRestoreCategories,
  parseBackupId,
  parseRestoreCategories,
  restoreCategoryCount,
  type RestoreCategory,
} from "@/lib/restore-apply";

export type RestorePreviewSection = {
  category: RestoreCategory;
  liveCount: number;
  backupCount: number;
};

export type RestorePreviewResult = {
  backup: {
    id: string;
    kind: "daily" | "manual";
    createdAt: string;
  };
  categories: RestoreCategory[];
  sections: RestorePreviewSection[];
};

export type RestoreExecuteResult = {
  ok: true;
  backup: RestorePreviewResult["backup"];
  categories: RestoreCategory[];
  restoredAt: string;
};

export type RestoreDependencies = {
  loadSnapshot: typeof loadRestorableSnapshot;
  readLive: typeof readLiveStoreRow;
  createPreRestore: typeof createPreRestoreSnapshot;
  writeLive: (data: AppData) => Promise<void>;
  /** Test override. Runtime uses `process.env.VERCEL_ENV`. */
  vercelEnv?: string;
};

/** Live execute is allowed only on Vercel Production. Preview/dev stay read-only. */
export function isLiveRestoreAllowed(
  env: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return env === "production";
}

const defaultDeps: RestoreDependencies = {
  loadSnapshot: loadRestorableSnapshot,
  readLive: readLiveStoreRow,
  createPreRestore: createPreRestoreSnapshot,
  writeLive: async (data) => {
    await replaceStorePayload(data);
    invalidateStoreCache();
  },
};

let restoreInFlight = false;

async function loadValidatedBackup(
  id: string,
  deps: RestoreDependencies,
): Promise<OyonStoreSnapshot & { purpose: "daily" | "manual" }> {
  parseBackupId(id);
  const snapshot = await deps.loadSnapshot(id);
  if (!snapshot) {
    throw new Error("RESTORE_BACKUP_NOT_FOUND");
  }
  const purpose = snapshot.purpose;
  if (purpose !== "daily" && purpose !== "manual") {
    throw new Error("RESTORE_BACKUP_NOT_RESTORABLE");
  }
  if (!snapshot.appData || typeof snapshot.appData !== "object") {
    throw new Error("RESTORE_BACKUP_INCOMPLETE");
  }
  return { ...snapshot, purpose };
}

export async function previewRestore(
  backupIdInput: unknown,
  categoriesInput: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestorePreviewResult> {
  const parsedId = parseBackupId(backupIdInput);
  const backupId = `${parsedId.kind}:${parsedId.createdAt}`;
  const categories = parseRestoreCategories(categoriesInput);
  const snapshot = await loadValidatedBackup(backupId, deps);
  const live = await deps.readLive();
  return {
    backup: {
      id: backupId,
      kind: snapshot.purpose,
      createdAt: snapshot.createdAt,
    },
    categories,
    sections: categories.map((category) => ({
      category,
      liveCount: restoreCategoryCount(live.payload, category),
      backupCount: restoreCategoryCount(snapshot.appData, category),
    })),
  };
}

export async function executeRestore(
  backupIdInput: unknown,
  categoriesInput: unknown,
  confirm: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestoreExecuteResult> {
  const vercelEnv =
    deps.vercelEnv !== undefined ? deps.vercelEnv : process.env.VERCEL_ENV;
  if (!isLiveRestoreAllowed(vercelEnv)) {
    throw new Error("RESTORE_PRODUCTION_ONLY");
  }
  if (confirm !== true) {
    throw new Error("RESTORE_CONFIRM_REQUIRED");
  }
  if (restoreInFlight) {
    throw new Error("RESTORE_IN_PROGRESS");
  }

  const parsedId = parseBackupId(backupIdInput);
  const backupId = `${parsedId.kind}:${parsedId.createdAt}`;
  const categories = parseRestoreCategories(categoriesInput);
  const snapshot = await loadValidatedBackup(backupId, deps);

  restoreInFlight = true;
  try {
    const pre = await deps.createPreRestore();
    if (!pre.complete || !pre.ok) {
      throw new Error("RESTORE_PRE_SNAPSHOT_FAILED");
    }

    const live = await deps.readLive();
    const next = applyRestoreCategories(
      live.payload,
      snapshot.appData,
      categories,
    );
    const restoredAt = new Date().toISOString();
    next.updatedAt = restoredAt;
    await deps.writeLive(next);

    return {
      ok: true,
      backup: {
        id: backupId,
        kind: snapshot.purpose,
        createdAt: snapshot.createdAt,
      },
      categories,
      restoredAt,
    };
  } finally {
    restoreInFlight = false;
  }
}

export function resetRestoreInFlightForTests() {
  restoreInFlight = false;
}
