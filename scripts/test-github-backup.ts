import assert from "node:assert/strict";
import {
  resetGithubBackupInFlightForTests,
  runGithubBackupAll,
  toGithubBackupClientResult,
  type GithubBackupDependencies,
  type GithubCommitFile,
} from "../lib/github-backup";
import { isGithubBackupAllowed } from "../lib/github-backup";
import type { AppData } from "../lib/types";

function sampleApp(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    products: [
      {
        id: "p1",
        slug: "a",
        name: "Live frame",
        category: "frames",
        brand: "OYON",
        sku: "L1",
        description: "",
        images: ["https://example.com/live.jpg"],
        purchasePrice: 1,
        sellingPrice: 2,
        stockQuantity: 4,
        minimumStock: 1,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    appointments: [],
    customers: [],
    staff: [{ id: "s1" } as AppData["staff"][number]],
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
    lensInventory: [
      {
        type: "minus",
        sph: "-1.00",
        cyl: "0.00",
        currentStock: 3,
        desiredStock: 5,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
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
      smtp: {},
      sms: { provider: "console", enabled: false },
      bookingMessages: {} as AppData["settings"]["bookingMessages"],
      appointmentSlotMinutes: 30,
      bookingLeadDays: 1,
      currency: "ILS",
      currencySymbol: "₪",
      servicePages: { eyeExam: { title: "Live exam" } } as AppData["settings"]["servicePages"],
    },
    updatedAt: "2026-09-26T12:00:00.000Z",
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
    async readJsonFile(path: string) {
      const bytes = files.get(path);
      if (!bytes) return null;
      return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    },
    async commitFiles(list: GithubCommitFile[], _message: string) {
      const token = process.env.GITHUB_BACKUP_TOKEN;
      if (token && _message.includes(token)) {
        throw new Error("token leaked into commit message");
      }
      for (const file of list) files.set(file.path, file.bytes);
      n += 1;
      const sha = `sha-${n}`;
      commits.push({ sha, paths: list.map((file) => file.path) });
      return sha;
    },
  };
}

function bytesOf(text: string) {
  return new Uint8Array(Buffer.from(text));
}

assert.equal(isGithubBackupAllowed("production"), true);
assert.equal(isGithubBackupAllowed("preview"), false);
assert.equal(isGithubBackupAllowed("development"), false);
assert.equal(isGithubBackupAllowed(undefined), false);

async function run() {
  const live = sampleApp();
  const productBytes = bytesOf("protected-product-bytes");
  const galleryBytes = bytesOf("live-gallery-bytes");

  function baseDeps(
    github: ReturnType<typeof createMemoryGithub>,
    extras: Partial<GithubBackupDependencies> & {
      protectedCalls?: string[];
      liveCalls?: string[];
    } = {},
  ): GithubBackupDependencies {
    const protectedCalls = extras.protectedCalls ?? [];
    const liveCalls = extras.liveCalls ?? [];
    return {
      vercelEnv: "production",
      readLive: async () => ({
        payload: structuredClone(live),
        updatedAt: live.updatedAt,
        payloadBytes: Buffer.byteLength(JSON.stringify(live)),
      }),
      listLiveMedia: async () => [
        { path: "products/frame.jpg", size: productBytes.byteLength, updatedAt: "2026-01-01T00:00:00.000Z" },
        { path: "gallery/hero.jpg", size: galleryBytes.byteLength, updatedAt: "2026-01-02T00:00:00.000Z" },
      ],
      downloadProtected: async (path) => {
        protectedCalls.push(path);
        if (path === "products/frame.jpg") {
          return { bytes: productBytes, contentType: "image/jpeg" };
        }
        return null;
      },
      downloadLive: async (path) => {
        liveCalls.push(path);
        if (path === "gallery/hero.jpg") {
          return { bytes: galleryBytes, contentType: "image/jpeg" };
        }
        throw new Error("unexpected live download");
      },
      github,
      ...extras,
    };
  }

  resetGithubBackupInFlightForTests();
  const blockedGithub = createMemoryGithub();
  let protectedCalls: string[] = [];
  await assert.rejects(
    () =>
      runGithubBackupAll(
        baseDeps(blockedGithub, { vercelEnv: "preview", protectedCalls }),
      ),
    /GITHUB_BACKUP_PRODUCTION_ONLY/,
  );
  assert.equal(blockedGithub.commits.length, 0);
  assert.equal(protectedCalls.length, 0);

  await assert.rejects(
    () =>
      runGithubBackupAll(
        baseDeps(createMemoryGithub(), { vercelEnv: "development" }),
      ),
    /GITHUB_BACKUP_PRODUCTION_ONLY/,
  );

  resetGithubBackupInFlightForTests();
  protectedCalls = [];
  const liveCalls: string[] = [];
  const github = createMemoryGithub({
    "backups/media/old/stale.jpg": bytesOf("keep-me"),
  });
  const first = await runGithubBackupAll(
    baseDeps(github, { protectedCalls, liveCalls }),
  );
  assert.equal(first.complete, true);
  assert.equal(first.copied, 2);
  assert.equal(first.skipped, 0);
  assert.equal(first.failed, 0);
  assert.equal(first.tooLarge.length, 0);
  assert.equal(first.currentLivePresentOnGithub, 2);
  assert.ok(first.githubCommitSha);
  assert.ok(first.appDataSha256);
  assert.deepEqual(protectedCalls, ["products/frame.jpg", "gallery/hero.jpg"]);
  assert.deepEqual(liveCalls, ["gallery/hero.jpg"]);
  assert.equal(
    Buffer.from(github.files.get("backups/media/products/frame.jpg")!).toString(),
    "protected-product-bytes",
  );
  assert.equal(
    Buffer.from(github.files.get("backups/media/gallery/hero.jpg")!).toString(),
    "live-gallery-bytes",
  );
  assert.equal(
    Buffer.from(github.files.get("backups/media/old/stale.jpg")!).toString(),
    "keep-me",
  );
  const database = JSON.parse(
    Buffer.from(github.files.get("backups/database.json")!).toString("utf8"),
  ) as AppData;
  assert.equal(database.products[0].id, "p1");
  assert.equal(database.settings.storeName, "Live");
  assert.equal(database.lensInventory[0].currentStock, 3);
  const client = toGithubBackupClientResult(first);
  const leaked = JSON.stringify(client);
  assert.equal(leaked.includes("GITHUB_BACKUP_TOKEN"), false);
  assert.equal(leaked.includes("ghp_"), false);
  assert.equal(leaked.includes("github_pat"), false);
  assert.equal("owner" in client, false);
  assert.equal("repo" in client, false);
  assert.equal("token" in client, false);

  resetGithubBackupInFlightForTests();
  const skipProtected: string[] = [];
  const skipLive: string[] = [];
  const second = await runGithubBackupAll(
    baseDeps(github, { protectedCalls: skipProtected, liveCalls: skipLive }),
  );
  assert.equal(second.complete, true);
  assert.equal(second.copied, 0);
  assert.equal(second.skipped, 2);
  assert.equal(skipProtected.length, 0);
  assert.equal(skipLive.length, 0);
  assert.equal(
    Buffer.from(github.files.get("backups/media/old/stale.jpg")!).toString(),
    "keep-me",
  );

  resetGithubBackupInFlightForTests();
  const timeoutGithub = createMemoryGithub();
  const timeout = await runGithubBackupAll(
    baseDeps(timeoutGithub, { timeBudgetMs: 0 }),
  );
  assert.equal(timeout.complete, false);
  assert.equal(timeout.timedOut, true);
  assert.equal(timeoutGithub.files.has("backups/database.json"), false);
  assert.equal(timeoutGithub.files.has("backups/media-index.json"), true);
  assert.equal(timeoutGithub.files.has("backups/backup-info.json"), true);

  resetGithubBackupInFlightForTests();
  const hugeGithub = createMemoryGithub();
  const huge = await runGithubBackupAll({
    ...baseDeps(hugeGithub),
    listLiveMedia: async () => [
      {
        path: "video/too-big.mp4",
        size: 100 * 1024 * 1024 + 1,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    downloadProtected: async () => {
      throw new Error("should not download too-large file");
    },
    downloadLive: async () => {
      throw new Error("should not download too-large file");
    },
  });
  assert.equal(huge.complete, false);
  assert.deepEqual(huge.tooLarge, ["video/too-big.mp4"]);
  assert.equal(hugeGithub.files.has("backups/database.json"), false);
  const hugeInfo = JSON.parse(
    Buffer.from(hugeGithub.files.get("backups/backup-info.json")!).toString("utf8"),
  ) as { complete: boolean; tooLarge: string[] };
  assert.equal(hugeInfo.complete, false);
  assert.deepEqual(hugeInfo.tooLarge, ["video/too-big.mp4"]);

  resetGithubBackupInFlightForTests();
  const failGithub = createMemoryGithub();
  const failed = await runGithubBackupAll({
    ...baseDeps(failGithub),
    listLiveMedia: async () => [
      { path: "products/missing.jpg", size: 12, updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    downloadProtected: async () => null,
    downloadLive: async () => {
      throw new Error("missing");
    },
  });
  assert.equal(failed.complete, false);
  assert.equal(failed.failed, 1);
  assert.equal(failGithub.files.has("backups/database.json"), false);

  console.log(
    JSON.stringify(
      {
        isolated: "pass",
        productionOnly: true,
        incrementalSkip: true,
        protectedPreferred: true,
        neverDelete: true,
        resumeWithoutDatabase: true,
        tooLargeBlocksComplete: true,
      },
      null,
      2,
    ),
  );
}

void run();
