import {
  createPreRestoreSnapshot,
  loadLatestPreRestoreSnapshot,
  loadRestorableSnapshot,
  readLiveStoreRow,
  type OyonStoreSnapshot,
} from "@/lib/backup";
import { invalidateStoreCache, replaceStorePayload } from "@/lib/db/store";
import type { AppData } from "@/lib/types";
import {
  parseRestoreCategories,
  type RestoreCategory,
} from "@/lib/restore-apply";
import {
  applyRestorePlan,
  collectRestoreMediaSource,
  parseRestoreRequest,
  sectionPreviewRows,
  validateRestorableAppData,
  type RestoreRequest,
} from "@/lib/restore-plan";
import {
  collectReferencedMediaPaths,
  restoreMissingMedia,
  toClientMediaResult,
  type RestoreMediaResult,
} from "@/lib/restore-media";
import type { RestorePreviewDetails } from "@/lib/restore-plan";

export type RestorePreviewSection = {
  category: string;
  liveCount: number;
  backupCount: number;
};

export type RestorePreviewResult = {
  backup: {
    id: string;
    kind: "daily" | "manual" | "pre-restore";
    createdAt: string;
  };
  mode: RestoreRequest["mode"];
  categories: RestoreCategory[];
  sections: RestorePreviewSection[];
  details: RestorePreviewDetails;
  media: {
    referenced: number;
    alreadyPresent: number;
    willRestore: number;
    missing: number;
  };
};

export type RestoreExecuteResult = {
  ok: true;
  backup: RestorePreviewResult["backup"];
  mode: RestoreRequest["mode"];
  categories: RestoreCategory[];
  restoredAt: string;
  media: ReturnType<typeof toClientMediaResult> & { complete: true };
};

export type RestoreDependencies = {
  loadSnapshot: typeof loadRestorableSnapshot;
  loadLatestPreRestore?: () => Promise<OyonStoreSnapshot | null>;
  readLive: typeof readLiveStoreRow;
  createPreRestore: typeof createPreRestoreSnapshot;
  writeLive: (data: AppData) => Promise<void>;
  restoreMedia?: (source: unknown) => Promise<RestoreMediaResult>;
  liveMediaExists?: (path: string) => Promise<boolean>;
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
  loadLatestPreRestore: loadLatestPreRestoreSnapshot,
  readLive: readLiveStoreRow,
  createPreRestore: createPreRestoreSnapshot,
  writeLive: async (data) => {
    await replaceStorePayload(data);
    invalidateStoreCache();
  },
  restoreMedia: (source) => restoreMissingMedia(source),
};

let restoreInFlight = false;

function snapshotIdOf(
  snapshot: OyonStoreSnapshot,
): RestorePreviewResult["backup"] {
  const purpose = snapshot.purpose;
  if (purpose !== "daily" && purpose !== "manual" && purpose !== "pre-restore") {
    throw new Error("RESTORE_BACKUP_NOT_RESTORABLE");
  }
  return {
    id: `${purpose}:${snapshot.createdAt}`,
    kind: purpose,
    createdAt: snapshot.createdAt,
  };
}

async function loadValidatedBackup(
  id: string,
  deps: RestoreDependencies,
  allowPreRestore: boolean,
): Promise<OyonStoreSnapshot> {
  const snapshot = await deps.loadSnapshot(id);
  if (!snapshot) {
    throw new Error("RESTORE_BACKUP_NOT_FOUND");
  }
  const purpose = snapshot.purpose;
  if (purpose === "pre-restore" && !allowPreRestore) {
    throw new Error("RESTORE_BACKUP_NOT_RESTORABLE");
  }
  if (purpose !== "daily" && purpose !== "manual" && purpose !== "pre-restore") {
    throw new Error("RESTORE_BACKUP_NOT_RESTORABLE");
  }
  validateRestorableAppData(snapshot.appData);
  return snapshot;
}

async function resolveRequestSnapshot(
  request: RestoreRequest,
  deps: RestoreDependencies,
): Promise<{ request: RestoreRequest; snapshot: OyonStoreSnapshot }> {
  if (request.mode === "rollback") {
    const snapshot = request.backupId
      ? await loadValidatedBackup(request.backupId, deps, true)
      : await (deps.loadLatestPreRestore ?? loadLatestPreRestoreSnapshot)();
    if (!snapshot) {
      throw new Error("RESTORE_ROLLBACK_NOT_FOUND");
    }
    if (snapshot.purpose !== "pre-restore") {
      throw new Error("RESTORE_BACKUP_NOT_RESTORABLE");
    }
    validateRestorableAppData(snapshot.appData);
    return {
      request: {
        mode: "rollback",
        backupId: `pre-restore:${snapshot.createdAt}`,
      },
      snapshot,
    };
  }
  const snapshot = await loadValidatedBackup(request.backupId, deps, false);
  return { request, snapshot };
}

async function forecastMedia(
  source: unknown,
  deps: RestoreDependencies,
): Promise<RestorePreviewResult["media"]> {
  const paths = collectReferencedMediaPaths(source);
  if (!deps.liveMediaExists) {
    return {
      referenced: paths.length,
      alreadyPresent: 0,
      willRestore: paths.length,
      missing: 0,
    };
  }
  let alreadyPresent = 0;
  for (const path of paths) {
    if (await deps.liveMediaExists(path)) alreadyPresent += 1;
  }
  return {
    referenced: paths.length,
    alreadyPresent,
    willRestore: Math.max(0, paths.length - alreadyPresent),
    missing: 0,
  };
}

export async function previewRestoreRequest(
  body: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestorePreviewResult> {
  const request = parseRestoreRequest(body);
  const resolved = await resolveRequestSnapshot(request, deps);
  const live = await deps.readLive();
  validateRestorableAppData(live.payload);
  const planned = applyRestorePlan(
    live.payload,
    resolved.snapshot.appData,
    resolved.request,
  );
  const mediaSource = collectRestoreMediaSource(
    live.payload,
    resolved.snapshot.appData,
    resolved.request,
    planned.next,
  );
  return {
    backup: snapshotIdOf(resolved.snapshot),
    mode: resolved.request.mode,
    categories:
      resolved.request.mode === "sections" ? resolved.request.categories : [],
    sections: sectionPreviewRows(
      live.payload,
      resolved.snapshot.appData,
      resolved.request,
    ).map((row) => ({
      category: row.key,
      liveCount: row.liveCount,
      backupCount: row.backupCount,
    })),
    details: planned.details,
    media: await forecastMedia(mediaSource, deps),
  };
}

/** Existing Admin preview: section categories only. */
export async function previewRestore(
  backupIdInput: unknown,
  categoriesInput: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestorePreviewResult> {
  return previewRestoreRequest(
    { backupId: backupIdInput, categories: categoriesInput, mode: "sections" },
    deps,
  );
}

export async function executeRestoreRequest(
  body: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestoreExecuteResult> {
  const vercelEnv =
    deps.vercelEnv !== undefined ? deps.vercelEnv : process.env.VERCEL_ENV;
  if (!isLiveRestoreAllowed(vercelEnv)) {
    throw new Error("RESTORE_PRODUCTION_ONLY");
  }
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== true) {
    throw new Error("RESTORE_CONFIRM_REQUIRED");
  }
  if (restoreInFlight) {
    throw new Error("RESTORE_IN_PROGRESS");
  }

  const request = parseRestoreRequest(body);
  restoreInFlight = true;
  try {
    const resolved = await resolveRequestSnapshot(request, deps);
    const pre = await deps.createPreRestore();
    if (!pre.complete || !pre.ok) {
      throw new Error("RESTORE_PRE_SNAPSHOT_FAILED");
    }

    const live = await deps.readLive();
    validateRestorableAppData(live.payload);
    const planned = applyRestorePlan(
      live.payload,
      resolved.snapshot.appData,
      resolved.request,
    );
    const mediaSource = collectRestoreMediaSource(
      live.payload,
      resolved.snapshot.appData,
      resolved.request,
      planned.next,
    );
    const media = deps.restoreMedia
      ? await deps.restoreMedia(mediaSource)
      : {
          complete: true,
          referenced: 0,
          alreadyPresent: 0,
          restored: 0,
          missing: 0,
          failed: 0,
        };
    if (!media.complete || media.missing > 0 || media.failed > 0) {
      throw new Error("RESTORE_MEDIA_FAILED");
    }

    const restoredAt = new Date().toISOString();
    planned.next.updatedAt = restoredAt;
    await deps.writeLive(planned.next);

    return {
      ok: true,
      backup: snapshotIdOf(resolved.snapshot),
      mode: resolved.request.mode,
      categories:
        resolved.request.mode === "sections" ? resolved.request.categories : [],
      restoredAt,
      media: { ...toClientMediaResult(media), complete: true },
    };
  } finally {
    restoreInFlight = false;
  }
}

export async function executeRestore(
  backupIdInput: unknown,
  categoriesInput: unknown,
  confirm: unknown,
  deps: RestoreDependencies = defaultDeps,
): Promise<RestoreExecuteResult> {
  return executeRestoreRequest(
    {
      backupId: backupIdInput,
      categories: categoriesInput,
      confirm,
      mode: "sections",
    },
    deps,
  );
}

export function resetRestoreInFlightForTests() {
  restoreInFlight = false;
}

export { parseRestoreCategories };
