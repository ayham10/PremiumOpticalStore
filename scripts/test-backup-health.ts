import assert from "node:assert/strict";
import {
  computeBackupHealthStatus,
  lastSuccessfulHistoryItem,
  snapshotHistoryStatus,
  type BackupHistoryItem,
} from "../lib/backup-status";
import { isRedactedBackupSecretKey } from "../lib/github-backup-plan";

assert.equal(snapshotHistoryStatus(undefined), "success");
assert.equal(snapshotHistoryStatus(true), "success");
assert.equal(snapshotHistoryStatus(false), "warning");

assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-15",
    lastRun: { ok: true, complete: true, date: "2026-10-15" },
  }),
  "healthy",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-14",
    lastRun: { ok: true, complete: true, date: "2026-10-14" },
  }),
  "healthy",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-14",
    lastRun: { ok: true, complete: false, date: "2026-10-15" },
  }),
  "warning",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-13",
    lastRun: null,
  }),
  "warning",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-12",
    lastRun: null,
  }),
  "failed",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: "2026-10-14",
    lastRun: { ok: false, complete: false, date: "2026-10-15" },
  }),
  "failed",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: null,
    lastRun: { ok: true, complete: false, date: "2026-10-15" },
  }),
  "warning",
);
assert.equal(
  computeBackupHealthStatus({
    today: "2026-10-15",
    latestCompleteDailyDate: null,
    lastRun: null,
  }),
  "none",
);

const history: BackupHistoryItem[] = [
  {
    id: "daily:2",
    kind: "daily",
    date: "2026-10-15",
    createdAt: "2026-10-15T00:00:00.000Z",
    sizeBytes: 1,
    appointments: 1,
    products: 1,
    lensInventory: 1,
    customers: 1,
    promotions: 0,
    settingsIncluded: true,
    mediaObjectCount: 2,
    status: "warning",
    complete: false,
  },
  {
    id: "daily:1",
    kind: "daily",
    date: "2026-10-14",
    createdAt: "2026-10-14T00:00:00.000Z",
    sizeBytes: 1,
    appointments: 1,
    products: 1,
    lensInventory: 1,
    customers: 1,
    promotions: 0,
    settingsIncluded: true,
    mediaObjectCount: 2,
    status: "success",
    complete: true,
  },
];
assert.equal(lastSuccessfulHistoryItem(history)?.id, "daily:1");

assert.equal(isRedactedBackupSecretKey("manageToken"), true);
assert.equal(isRedactedBackupSecretKey("password"), true);
assert.equal(isRedactedBackupSecretKey("manageTokenHash"), false);
assert.equal(isRedactedBackupSecretKey("manageTokenExpiresAt"), false);
assert.equal(isRedactedBackupSecretKey("manageTokenRevokedAt"), false);
assert.equal(isRedactedBackupSecretKey("manageTemplateContentSid"), false);
assert.equal(isRedactedBackupSecretKey("storeName"), false);

console.log("test-backup-health: ok");
