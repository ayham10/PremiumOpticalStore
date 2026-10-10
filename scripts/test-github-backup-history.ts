import assert from "node:assert/strict";
import {
  collectExternalMediaUrls,
  githubBackupDate,
  githubBackupIncompleteReason,
  githubBackupRetentionDays,
  githubDailyManifestPath,
  githubDailySnapshotPath,
  parseGithubHistory,
  planDailyRetention,
  redactBackupSecrets,
  retentionDeletePaths,
  sha256Json,
  upsertHistorySnapshot,
  validateGithubRecoveryPoint,
  verifyChecksum,
} from "../lib/github-backup-plan";
import {
  readGithubBackupStatus,
  resetGithubBackupInFlightForTests,
  runGithubBackupAll,
  toGithubBackupClientResult,
  type GithubBackupDependencies,
  type GithubCommitFile,
} from "../lib/github-backup";
import type { AppData } from "../lib/types";

function sampleApp(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    products: [
      {
        id: "p1",
        slug: "a",
        name: "Live frame",
        category: "Frames",
        brand: "OYON",
        sku: "L1",
        description: "",
        images: [
          "https://example.supabase.co/storage/v1/object/public/lumina-media/products/frame.jpg",
          "https://cdn.example.com/external.png",
        ],
        purchasePrice: 1,
        sellingPrice: 2,
        stockQuantity: 4,
        minimumStock: 1,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    catalogCategories: [],
    appointments: [],
    customers: [],
    staff: [],
    suppliers: [],
    promotions: [],
    media: [],
    reviews: [],
    contactMessages: [],
    smsLogs: [],
    activityLogs: [],
    holidays: [],
    availability: [],
    eyeExamAvailability: [],
    eyeExamAppointments: [{ id: "b1" } as AppData["eyeExamAppointments"][number]],
    bookingServices: [],
    lensInventory: [],
    settings: {
      storeName: "Live",
      tagline: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      whatsapp: "",
      googleMapsEmbedUrl: "",
      googleMapsLink: "",
      openingHours: [],
      social: {},
      seo: { title: "", description: "", keywords: "" },
      smtp: { host: "smtp.example.com", password: "super-secret" } as AppData["settings"]["smtp"],
      sms: { provider: "console", enabled: false },
      bookingMessages: {} as AppData["settings"]["bookingMessages"],
      appointmentSlotMinutes: 30,
      bookingLeadDays: 1,
      currency: "ILS",
      currencySymbol: "₪",
      servicePages: { eyeExam: { title: "فحص" } } as AppData["settings"]["servicePages"],
    },
    updatedAt: "2026-10-10T12:00:00.000Z",
    ...overrides,
  };
}

function createMemoryGithub(initial: Record<string, Uint8Array | string> = {}) {
  const files = new Map<string, Uint8Array>();
  for (const [path, value] of Object.entries(initial)) {
    files.set(
      path,
      typeof value === "string" ? new Uint8Array(Buffer.from(value)) : value,
    );
  }
  let n = 0;
  const commits: Array<{ sha: string; paths: string[] }> = [];
  return {
    files,
    commits,
    async probeRepository() {
      return;
    },
    async ensureReady() {
      return;
    },
    async readJsonFile(path: string) {
      const bytes = files.get(path);
      if (!bytes) return null;
      return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    },
    async commitFiles(list: GithubCommitFile[]) {
      const paths: string[] = [];
      for (const file of list) {
        if (file.delete) {
          files.delete(file.path);
          paths.push(file.path);
          continue;
        }
        if (!file.bytes) throw new Error("missing file bytes");
        files.set(file.path, file.bytes);
        paths.push(file.path);
      }
      n += 1;
      const sha = `sha-${n}`;
      commits.push({ sha, paths });
      return sha;
    },
  };
}

assert.equal(githubBackupDate("2026-10-10T12:00:00.000Z"), "2026-10-10");
assert.equal(githubBackupRetentionDays(undefined), 30);
assert.equal(githubBackupRetentionDays("7"), 7);
assert.equal(githubBackupRetentionDays("0"), 1);
assert.equal(githubDailySnapshotPath("2026-10-10"), "backups/daily/2026-10-10.json");
assert.equal(
  githubDailyManifestPath("2026-10-10"),
  "backups/daily/2026-10-10.manifest.json",
);

const redacted = redactBackupSecrets(sampleApp());
assert.equal((redacted.settings.smtp as { password?: string }).password, "");
assert.equal(redacted.settings.storeName, "Live");
assert.deepEqual(collectExternalMediaUrls(sampleApp()), [
  "https://cdn.example.com/external.png",
]);

const planned = planDailyRetention(
  [
    {
      date: "2026-09-01",
      createdAt: "2026-09-01T00:00:00.000Z",
      complete: true,
      verified: true,
      appDataSha256: "a",
      mediaFileCount: 1,
      missingMedia: 0,
      failedMedia: 0,
    },
    {
      date: "2026-10-09",
      createdAt: "2026-10-09T00:00:00.000Z",
      complete: true,
      verified: true,
      appDataSha256: "b",
      mediaFileCount: 1,
      missingMedia: 0,
      failedMedia: 0,
    },
    {
      date: "2026-10-10",
      createdAt: "2026-10-10T00:00:00.000Z",
      complete: true,
      verified: true,
      appDataSha256: "c",
      mediaFileCount: 1,
      missingMedia: 0,
      failedMedia: 0,
    },
  ],
  "2026-10-10",
  30,
);
assert.deepEqual(planned.deleteDates, ["2026-09-01"]);
assert.ok(planned.keep.some((item) => item.date === "2026-10-10"));
assert.deepEqual(retentionDeletePaths(["2026-09-01"]), [
  "backups/daily/2026-09-01.json",
  "backups/daily/2026-09-01.manifest.json",
]);

const noDeleteNewest = planDailyRetention(
  [
    {
      date: "2026-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      complete: true,
      verified: true,
      appDataSha256: "old",
      mediaFileCount: 0,
      missingMedia: 0,
      failedMedia: 0,
    },
  ],
  "2026-10-10",
  30,
);
assert.deepEqual(noDeleteNewest.deleteDates, []);

const checksum = sha256Json({ ok: true });
assert.equal(
  verifyChecksum(
    new Uint8Array(Buffer.from(`${JSON.stringify({ ok: true }, null, 2)}\n`)),
    checksum,
  ),
  true,
);

function deps(
  github: ReturnType<typeof createMemoryGithub>,
  extras: Partial<GithubBackupDependencies> = {},
): GithubBackupDependencies {
  const live = sampleApp();
  return {
    vercelEnv: "production",
    now: () => Date.parse("2026-10-10T12:00:00.000Z"),
    readLive: async () => ({
      payload: structuredClone(live),
      updatedAt: live.updatedAt,
      payloadBytes: 10,
    }),
    listLiveMedia: async () => [
      { path: "products/frame.jpg", size: 4, updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    downloadProtected: async () => ({
      bytes: new Uint8Array([1, 2, 3, 4]),
      contentType: "image/jpeg",
    }),
    downloadLive: async () => {
      throw new Error("unexpected live download");
    },
    github,
    ...extras,
  };
}

async function run() {
  resetGithubBackupInFlightForTests();
  const github = createMemoryGithub();
  const first = await runGithubBackupAll(deps(github));
  assert.equal(first.complete, true);
  assert.equal(first.verified, true);
  assert.equal(first.date, "2026-10-10");
  assert.equal(first.dailySnapshotPath, "backups/daily/2026-10-10.json");
  assert.equal(first.externalMediaCount, 1);
  assert.ok(github.files.has("backups/daily/2026-10-10.json"));
  assert.ok(github.files.has("backups/daily/2026-10-10.manifest.json"));
  assert.ok(github.files.has("backups/history.json"));
  const snapshot = JSON.parse(
    Buffer.from(github.files.get("backups/daily/2026-10-10.json")!).toString("utf8"),
  ) as AppData;
  assert.equal((snapshot.settings.smtp as { password?: string }).password, "");
  assert.equal(snapshot.settings.servicePages?.eyeExam?.title, "فحص");
  const manifest = JSON.parse(
    Buffer.from(github.files.get("backups/daily/2026-10-10.manifest.json")!).toString(
      "utf8",
    ),
  ) as { complete: boolean; appDataSha256: string };
  assert.equal(manifest.complete, true);
  assert.ok(
    verifyChecksum(github.files.get("backups/daily/2026-10-10.json")!, manifest.appDataSha256),
  );
  const recovery = validateGithubRecoveryPoint(
    snapshot,
    manifest,
    github.files.get("backups/daily/2026-10-10.json"),
  );
  assert.equal(recovery.ok, true);

  resetGithubBackupInFlightForTests();
  const rerun = await runGithubBackupAll(deps(github));
  assert.equal(rerun.complete, true);
  const history = parseGithubHistory(await github.readJsonFile("backups/history.json"));
  assert.equal(history.snapshots.filter((item) => item.date === "2026-10-10").length, 1);

  resetGithubBackupInFlightForTests();
  const failGithub = createMemoryGithub();
  await runGithubBackupAll(deps(failGithub));
  resetGithubBackupInFlightForTests();
  const failed = await runGithubBackupAll(
    deps(failGithub, {
      listLiveMedia: async () => [
        { path: "products/gone.jpg", size: 4, updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      downloadProtected: async () => null,
      downloadLive: async () => {
        throw new Error("GITHUB_BACKUP_LIVE_MEDIA_MISSING");
      },
    }),
  );
  assert.equal(failed.complete, false);
  assert.ok(failGithub.files.has("backups/daily/2026-10-10.json"));
  const kept = JSON.parse(
    Buffer.from(failGithub.files.get("backups/daily/2026-10-10.json")!).toString("utf8"),
  ) as AppData;
  assert.equal(kept.products[0].id, "p1");

  resetGithubBackupInFlightForTests();
  const retainGithub = createMemoryGithub({
    "backups/history.json": JSON.stringify({
      version: 1,
      retentionDays: 30,
      lastRun: null,
      snapshots: [
        {
          date: "2026-09-01",
          createdAt: "2026-09-01T00:00:00.000Z",
          complete: true,
          verified: true,
          appDataSha256: "old",
          mediaFileCount: 1,
          missingMedia: 0,
          failedMedia: 0,
        },
      ],
    }),
    "backups/daily/2026-09-01.json": JSON.stringify({ keep: true }),
    "backups/daily/2026-09-01.manifest.json": JSON.stringify({ complete: true }),
  });
  const retained = await runGithubBackupAll(deps(retainGithub));
  assert.equal(retained.complete, true);
  assert.equal(retainGithub.files.has("backups/daily/2026-09-01.json"), false);
  assert.equal(retainGithub.files.has("backups/daily/2026-10-10.json"), true);

  resetGithubBackupInFlightForTests();
  const noRetainOnFail = createMemoryGithub({
    "backups/history.json": JSON.stringify({
      version: 1,
      retentionDays: 30,
      lastRun: null,
      snapshots: [
        {
          date: "2026-09-01",
          createdAt: "2026-09-01T00:00:00.000Z",
          complete: true,
          verified: true,
          appDataSha256: "old",
          mediaFileCount: 1,
          missingMedia: 0,
          failedMedia: 0,
        },
      ],
    }),
    "backups/daily/2026-09-01.json": JSON.stringify({ keep: true }),
  });
  await runGithubBackupAll(
    deps(noRetainOnFail, {
      listLiveMedia: async () => [
        { path: "products/gone.jpg", size: 4, updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
      downloadProtected: async () => null,
      downloadLive: async () => {
        throw new Error("GITHUB_BACKUP_LIVE_MEDIA_MISSING");
      },
    }),
  );
  assert.equal(noRetainOnFail.files.has("backups/daily/2026-09-01.json"), true);
  assert.equal(noRetainOnFail.files.has("backups/daily/2026-10-10.json"), false);

  const badRecovery = validateGithubRecoveryPoint(
    { products: [] },
    { kind: "oyon-github-daily-manifest", complete: false, verified: false },
  );
  assert.equal(badRecovery.ok, false);
  assert.ok(badRecovery.errors.includes("GITHUB_RECOVERY_NOT_COMPLETE"));

  const merged = upsertHistorySnapshot(parseGithubHistory(null), {
    date: "2026-10-10",
    createdAt: "2026-10-10T00:00:00.000Z",
    complete: true,
    verified: true,
    appDataSha256: "x",
    mediaFileCount: 1,
    missingMedia: 0,
    failedMedia: 0,
  });
  assert.equal(merged.snapshots.length, 1);

  const status = await readGithubBackupStatus({
    vercelEnv: "preview",
    github: github,
  });
  assert.equal(status.enabled, false);
  assert.equal(status.snapshots.length, 0);

  const liveStatus = await readGithubBackupStatus({
    vercelEnv: "production",
    github,
  });
  assert.equal(liveStatus.enabled, true);
  assert.ok(liveStatus.snapshots.some((item) => item.date === "2026-10-10" && item.complete));
  assert.equal(JSON.stringify(liveStatus).includes("super-secret"), false);
  assert.equal(JSON.stringify(liveStatus).includes("cdn.example.com"), false);

  await assert.rejects(
    () =>
      runGithubBackupAll(
        deps(createMemoryGithub(), {
          github: {
            ...createMemoryGithub(),
            async commitFiles() {
              throw new Error("GITHUB_BACKUP_API_FAILED");
            },
          },
        }),
      ),
    /GITHUB_BACKUP_API_FAILED/,
  );

  assert.equal(
    githubBackupIncompleteReason({
      complete: false,
      timedOut: true,
      failed: 0,
      tooLarge: 0,
      remainingMedia: 40,
    }),
    "timeout",
  );
  assert.equal(
    githubBackupIncompleteReason({
      complete: false,
      timedOut: false,
      failed: 2,
      tooLarge: 0,
      remainingMedia: 2,
    }),
    "media_failed",
  );
  assert.equal(
    githubBackupIncompleteReason({
      complete: true,
      timedOut: false,
      failed: 0,
      tooLarge: 0,
      remainingMedia: 0,
    }),
    null,
  );

  resetGithubBackupInFlightForTests();
  const resumeGithub = createMemoryGithub();
  const resumePaths = ["products/a.jpg", "products/b.jpg", "products/c.jpg"];
  let clock = Date.parse("2026-10-10T12:00:00.000Z");
  const resumeDeps = (): GithubBackupDependencies =>
    deps(resumeGithub, {
      now: () => clock,
      timeBudgetMs: 15_000,
      listLiveMedia: async () =>
        resumePaths.map((path) => ({
          path,
          size: 4,
          updatedAt: "2026-01-01T00:00:00.000Z",
        })),
      downloadProtected: async () => {
        clock += 20_000;
        return { bytes: new Uint8Array([1, 2, 3, 4]), contentType: "image/jpeg" };
      },
    });

  const resumeFirst = await runGithubBackupAll(resumeDeps());
  assert.equal(resumeFirst.complete, false);
  assert.equal(resumeFirst.timedOut, true);
  assert.equal(resumeFirst.copied, 1);
  assert.equal(resumeFirst.remainingMedia, 2);
  assert.equal(resumeFirst.incompleteReason, "timeout");
  assert.equal(resumeGithub.files.has("backups/database.json"), false);
  assert.ok(resumeGithub.files.has("backups/media/products/a.jpg"));
  assert.equal(resumeGithub.files.has("backups/media/products/b.jpg"), false);
  const resumeClient = toGithubBackupClientResult(resumeFirst);
  assert.equal(resumeClient.incompleteReason, "timeout");
  assert.equal(resumeClient.copied, 1);

  resetGithubBackupInFlightForTests();
  const resumeSecond = await runGithubBackupAll(resumeDeps());
  assert.equal(resumeSecond.complete, false);
  assert.equal(resumeSecond.skipped, 1);
  assert.equal(resumeSecond.copied, 1);
  assert.ok(resumeGithub.files.has("backups/media/products/b.jpg"));
  assert.equal(resumeGithub.files.has("backups/database.json"), false);

  resetGithubBackupInFlightForTests();
  const resumeThird = await runGithubBackupAll(resumeDeps());
  assert.equal(resumeThird.complete, true);
  assert.equal(resumeThird.verified, true);
  assert.equal(resumeThird.skipped, 2);
  assert.equal(resumeThird.copied, 1);
  assert.ok(resumeGithub.files.has("backups/database.json"));
  assert.ok(resumeGithub.files.has("backups/daily/2026-10-10.json"));

  resetGithubBackupInFlightForTests();
  const flushGithub = createMemoryGithub();
  const flushPaths = Array.from({ length: 8 }, (_, index) => `products/f${index}.jpg`);
  const flushed = await runGithubBackupAll(
    deps(flushGithub, {
      listLiveMedia: async () =>
        flushPaths.map((path) => ({
          path,
          size: 4,
          updatedAt: "2026-01-01T00:00:00.000Z",
        })),
    }),
  );
  assert.equal(flushed.complete, true);
  assert.ok(flushGithub.commits.length >= 3, "media progress should commit in batches");
  for (const path of flushPaths) {
    assert.ok(flushGithub.files.has(`backups/media/${path}`));
  }

  const legacyHistory = parseGithubHistory({
    version: 1,
    retentionDays: 30,
    lastRun: {
      createdAt: "2026-10-10T12:00:00.000Z",
      complete: false,
      timedOut: true,
      remainingMedia: 40,
      copied: 12,
      failed: 0,
      tooLarge: 0,
      mediaFileCount: 12,
    },
    snapshots: [],
  });
  assert.equal(legacyHistory.lastRun?.skipped, 0);
  assert.equal(legacyHistory.lastRun?.reason, "timeout");

  console.log(
    JSON.stringify(
      {
        isolated: "pass",
        datedSnapshot: true,
        sameDayRerun: true,
        retention: true,
        failedPreserves: true,
        checksum: true,
        missingMedia: true,
        recoveryValidation: true,
        githubApiError: true,
        resumeAcrossClicks: true,
        batchedMediaFlush: true,
        incompleteReason: true,
      },
      null,
      2,
    ),
  );
}

void run();
