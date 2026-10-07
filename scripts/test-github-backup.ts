import assert from "node:assert/strict";
import {
  createGithubRepoClient,
  downloadStorageObject,
  formatGithubBackupDiagnostic,
  isAbsentStorageStatus,
  isGithubBackupAllowed,
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
    async probeRepository() {
      return;
    },
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
assert.equal(isAbsentStorageStatus(400), true);
assert.equal(isAbsentStorageStatus(404), true);
assert.equal(isAbsentStorageStatus(401), false);
assert.equal(isAbsentStorageStatus(403), false);
assert.equal(isAbsentStorageStatus(500), false);
assert.equal(
  formatGithubBackupDiagnostic(
    "POST",
    "/repos/ayham10/oyon-backups/git/blobs",
    409,
    { message: "Git Repository is empty." },
  ),
  "POST /repos/ayham10/oyon-backups/git/blobs → 409: Git Repository is empty.",
);
assert.equal(
  formatGithubBackupDiagnostic(
    "POST",
    "/repos/ayham10/oyon-backups/git/blobs",
    409,
    { message: "leak github_pat_test_secret_value and Bearer abc" },
  ).includes("github_pat_test_secret_value"),
  false,
);

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

  resetGithubBackupInFlightForTests();
  const probeGithub = createMemoryGithub();
  let probeReadLive = 0;
  let probeListMedia = 0;
  let probeProtected = 0;
  let probeLive = 0;
  await assert.rejects(
    () =>
      runGithubBackupAll({
        ...baseDeps(probeGithub),
        github: {
          ...probeGithub,
          async probeRepository() {
            throw new Error("GITHUB_BACKUP_REPO_INACCESSIBLE");
          },
        },
        readLive: async () => {
          probeReadLive += 1;
          throw new Error("should not read live after inaccessible repo");
        },
        listLiveMedia: async () => {
          probeListMedia += 1;
          return [];
        },
        downloadProtected: async () => {
          probeProtected += 1;
          return null;
        },
        downloadLive: async () => {
          probeLive += 1;
          throw new Error("should not download live after inaccessible repo");
        },
      }),
    /GITHUB_BACKUP_REPO_INACCESSIBLE/,
  );
  assert.equal(probeGithub.commits.length, 0);
  assert.equal(probeReadLive, 0);
  assert.equal(probeListMedia, 0);
  assert.equal(probeProtected, 0);
  assert.equal(probeLive, 0);

  resetGithubBackupInFlightForTests();
  const firstRunGithub = createMemoryGithub();
  assert.equal(firstRunGithub.files.has("backups/media-index.json"), false);
  assert.equal(firstRunGithub.files.has("backups/backup-info.json"), false);
  const firstRun = await runGithubBackupAll(baseDeps(firstRunGithub));
  assert.equal(firstRun.complete, true);
  assert.equal(firstRun.copied, 2);
  assert.equal(firstRunGithub.files.has("backups/media-index.json"), true);
  assert.equal(firstRunGithub.files.has("backups/backup-info.json"), true);
  assert.equal(firstRunGithub.files.has("backups/database.json"), true);

  resetGithubBackupInFlightForTests();
  const fallbackGithub = createMemoryGithub();
  const fallbackProtected: string[] = [];
  const fallbackLive: string[] = [];
  const fallback = await runGithubBackupAll({
    ...baseDeps(fallbackGithub, {
      protectedCalls: fallbackProtected,
      liveCalls: fallbackLive,
    }),
    listLiveMedia: async () => [
      {
        path: "products/frame.jpg",
        size: productBytes.byteLength,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    downloadProtected: async (path) => {
      fallbackProtected.push(path);
      return null;
    },
    downloadLive: async (path) => {
      fallbackLive.push(path);
      if (path === "products/frame.jpg") {
        return { bytes: galleryBytes, contentType: "image/jpeg" };
      }
      throw new Error("unexpected live download");
    },
  });
  assert.equal(fallback.complete, true);
  assert.deepEqual(fallbackProtected, ["products/frame.jpg"]);
  assert.deepEqual(fallbackLive, ["products/frame.jpg"]);
  assert.equal(
    Buffer.from(
      fallbackGithub.files.get("backups/media/products/frame.jpg")!,
    ).toString(),
    "live-gallery-bytes",
  );

  resetGithubBackupInFlightForTests();
  const missingLiveGithub = createMemoryGithub();
  const missingLive = await runGithubBackupAll({
    ...baseDeps(missingLiveGithub),
    listLiveMedia: async () => [
      {
        path: "products/gone.jpg",
        size: 8,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    downloadProtected: async () => null,
    downloadLive: async () => {
      throw new Error("GITHUB_BACKUP_LIVE_MEDIA_MISSING");
    },
  });
  assert.equal(missingLive.complete, false);
  assert.equal(missingLive.failed, 1);
  assert.equal(missingLiveGithub.files.has("backups/database.json"), false);

  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_BACKUP_TOKEN;
  const originalOwner = process.env.GITHUB_BACKUP_OWNER;
  const originalRepo = process.env.GITHUB_BACKUP_REPO;
  const originalBranch = process.env.GITHUB_BACKUP_BRANCH;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseKey = process.env.SUPABASE_SECRET_KEY;
  const originalLogs = console.error;
  const errorLogs: string[] = [];
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map((value) => String(value)).join(" "));
  };

  process.env.GITHUB_BACKUP_TOKEN = "github_pat_test_secret_value";
  process.env.GITHUB_BACKUP_OWNER = "ayham10";
  process.env.GITHUB_BACKUP_REPO = "oyon-backups";
  process.env.GITHUB_BACKUP_BRANCH = "main";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb-test-secret-key";

  try {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const inaccessible = createGithubRepoClient();
    await assert.rejects(
      () => inaccessible.probeRepository(),
      /GITHUB_BACKUP_REPO_INACCESSIBLE/,
    );
    assert.deepEqual(urls, [
      "https://api.github.com/repos/ayham10/oyon-backups",
    ]);
    assert.equal(
      errorLogs.some((line) => line.includes("repository inaccessible")),
      true,
    );
    assert.equal(
      errorLogs.some((line) => line.includes("GitHub backup API failed")),
      false,
    );

    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/contents/backups/media-index.json")) {
        return new Response("Not Found", { status: 404 });
      }
      if (url.includes("/contents/backups/backup-info.json")) {
        return new Response("Not Found", { status: 404 });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const filesClient = createGithubRepoClient();
    assert.equal(await filesClient.readJsonFile("backups/media-index.json"), null);
    assert.equal(await filesClient.readJsonFile("backups/backup-info.json"), null);
    assert.equal(errorLogs.length, 0);
    assert.equal(
      urls[0]?.includes(
        "/repos/ayham10/oyon-backups/contents/backups/media-index.json?ref=main",
      ),
      true,
    );

    function jsonResponse(status: number, body: unknown) {
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }

    function recorded(input: RequestInfo | URL, init?: RequestInit) {
      const method = (init?.method || "GET").toUpperCase();
      const url = String(input);
      let body: unknown = null;
      if (init?.body) {
        try {
          body = JSON.parse(String(init.body)) as unknown;
        } catch {
          body = null;
        }
      }
      const call = { method, url, body };
      urls.push(`${method} ${url}`);
      return call;
    }

    const existingCalls: Array<{ method: string; url: string; body: unknown }> =
      [];
    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = recorded(input, init);
      existingCalls.push(call);
      if (call.method === "GET" && call.url.endsWith("/git/ref/heads/main")) {
        return jsonResponse(200, {
          ref: "refs/heads/main",
          object: { sha: "readme-commit-sha", type: "commit" },
        });
      }
      if (
        call.method === "GET" &&
        call.url.endsWith("/git/commits/readme-commit-sha")
      ) {
        return jsonResponse(200, {
          sha: "readme-commit-sha",
          tree: { sha: "readme-tree-sha" },
        });
      }
      if (call.method === "POST" && call.url.endsWith("/git/blobs")) {
        return jsonResponse(201, { sha: "blob-sha-1" });
      }
      if (call.method === "POST" && call.url.endsWith("/git/trees")) {
        return jsonResponse(201, { sha: "tree-sha-2" });
      }
      if (call.method === "POST" && call.url.endsWith("/git/commits")) {
        return jsonResponse(201, { sha: "commit-sha-2" });
      }
      if (
        call.method === "PATCH" &&
        call.url.endsWith("/git/refs/heads/main")
      ) {
        return jsonResponse(200, {
          ref: "refs/heads/main",
          object: { sha: "commit-sha-2" },
        });
      }
      throw new Error(`unexpected fetch ${call.method} ${call.url}`);
    }) as typeof fetch;

    const existingClient = createGithubRepoClient();
    const existingSha = await existingClient.commitFiles(
      [{ path: "backups/media-index.json", bytes: bytesOf("{}") }],
      "OYON GitHub backup existing main",
    );
    assert.equal(existingSha, "commit-sha-2");
    assert.equal(
      existingCalls.some(
        (call) => call.method === "POST" && call.url.endsWith("/git/refs"),
      ),
      false,
    );
    assert.equal(
      existingCalls.some((call) =>
        call.url.includes("/contents/backups/.keep"),
      ),
      false,
    );
    const treeCall = existingCalls.find(
      (call) => call.method === "POST" && call.url.endsWith("/git/trees"),
    );
    assert.equal(
      (treeCall?.body as { base_tree?: string } | null)?.base_tree,
      "readme-tree-sha",
    );
    const commitCall = existingCalls.find(
      (call) => call.method === "POST" && call.url.endsWith("/git/commits"),
    );
    assert.deepEqual(
      (commitCall?.body as { parents?: string[] } | null)?.parents,
      ["readme-commit-sha"],
    );
    assert.equal(
      existingCalls.some(
        (call) => call.method === "PATCH" && call.url.endsWith("/git/refs/heads/main"),
      ),
      true,
    );
    assert.equal(errorLogs.length, 0);

    const emptyCalls: Array<{ method: string; url: string; body: unknown }> = [];
    let emptyRefReads = 0;
    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = recorded(input, init);
      emptyCalls.push(call);
      if (call.method === "GET" && call.url.endsWith("/git/ref/heads/main")) {
        emptyRefReads += 1;
        if (emptyRefReads === 1) {
          return jsonResponse(409, { message: "Git Repository is empty." });
        }
        return jsonResponse(200, {
          ref: "refs/heads/main",
          object: { sha: "bootstrap-commit-sha", type: "commit" },
        });
      }
      if (
        call.method === "PUT" &&
        call.url.endsWith("/contents/backups/.keep")
      ) {
        return jsonResponse(201, { content: { path: "backups/.keep" } });
      }
      if (
        call.method === "GET" &&
        call.url.endsWith("/git/commits/bootstrap-commit-sha")
      ) {
        return jsonResponse(200, {
          sha: "bootstrap-commit-sha",
          tree: { sha: "bootstrap-tree-sha" },
        });
      }
      if (call.method === "POST" && call.url.endsWith("/git/blobs")) {
        return jsonResponse(201, { sha: "blob-sha-empty" });
      }
      if (call.method === "POST" && call.url.endsWith("/git/trees")) {
        return jsonResponse(201, { sha: "tree-sha-empty" });
      }
      if (call.method === "POST" && call.url.endsWith("/git/commits")) {
        return jsonResponse(201, { sha: "commit-sha-empty" });
      }
      if (
        call.method === "PATCH" &&
        call.url.endsWith("/git/refs/heads/main")
      ) {
        return jsonResponse(200, { object: { sha: "commit-sha-empty" } });
      }
      throw new Error(`unexpected fetch ${call.method} ${call.url}`);
    }) as typeof fetch;

    const emptyClient = createGithubRepoClient();
    const emptySha = await emptyClient.commitFiles(
      [{ path: "backups/media-index.json", bytes: bytesOf("{}") }],
      "OYON GitHub backup empty repo",
    );
    assert.equal(emptySha, "commit-sha-empty");
    assert.equal(
      emptyCalls.some(
        (call) =>
          call.method === "PUT" && call.url.endsWith("/contents/backups/.keep"),
      ),
      true,
    );
    assert.equal(
      emptyCalls.some(
        (call) => call.method === "POST" && call.url.endsWith("/git/refs"),
      ),
      false,
    );
    const emptyTree = emptyCalls.find(
      (call) => call.method === "POST" && call.url.endsWith("/git/trees"),
    );
    assert.equal(
      (emptyTree?.body as { base_tree?: string } | null)?.base_tree,
      "bootstrap-tree-sha",
    );
    const emptyCommit = emptyCalls.find(
      (call) => call.method === "POST" && call.url.endsWith("/git/commits"),
    );
    assert.deepEqual(
      (emptyCommit?.body as { parents?: string[] } | null)?.parents,
      ["bootstrap-commit-sha"],
    );
    assert.equal(
      emptyCalls.some(
        (call) => call.method === "PATCH" && call.url.endsWith("/git/refs/heads/main"),
      ),
      true,
    );

    const conflictCalls: Array<{ method: string; url: string; body: unknown }> =
      [];
    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = recorded(input, init);
      conflictCalls.push(call);
      if (call.method === "GET" && call.url.endsWith("/git/ref/heads/main")) {
        return jsonResponse(409, { message: "Repository is unavailable." });
      }
      throw new Error(`unexpected fetch ${call.method} ${call.url}`);
    }) as typeof fetch;

    const conflictClient = createGithubRepoClient();
    await assert.rejects(
      () =>
        conflictClient.commitFiles(
          [{ path: "backups/media-index.json", bytes: bytesOf("{}") }],
          "OYON GitHub backup conflict",
        ),
      /GITHUB_BACKUP_API_FAILED/,
    );
    assert.equal(
      conflictCalls.some(
        (call) => call.method === "POST" && call.url.endsWith("/git/refs"),
      ),
      false,
    );
    assert.equal(
      conflictCalls.some((call) => call.url.includes("/git/blobs")),
      false,
    );
    assert.equal(
      errorLogs.some((line) =>
        line.includes(
          "GitHub backup ref lookup failed: GET /repos/ayham10/oyon-backups/git/ref/heads/main → 409: Repository is unavailable.",
        ),
      ),
      true,
    );

    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      recorded(input, init);
      const method = (init?.method || "GET").toUpperCase();
      const url = String(input);
      if (method === "GET" && url.endsWith("/git/ref/heads/main")) {
        return jsonResponse(200, {
          object: { sha: "readme-commit-sha", type: "commit" },
        });
      }
      if (method === "GET" && url.endsWith("/git/commits/readme-commit-sha")) {
        return jsonResponse(200, { tree: { sha: "readme-tree-sha" } });
      }
      if (method === "POST" && url.endsWith("/git/blobs")) {
        return jsonResponse(409, { message: "Git Repository is empty." });
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    }) as typeof fetch;

    const writeClient = createGithubRepoClient();
    await assert.rejects(
      () =>
        writeClient.commitFiles(
          [{ path: "backups/media-index.json", bytes: bytesOf("{}") }],
          "OYON GitHub backup test",
        ),
      /GITHUB_BACKUP_API_FAILED/,
    );
    assert.equal(
      errorLogs.some((line) =>
        line.includes(
          "GitHub backup write failed: POST /repos/ayham10/oyon-backups/git/blobs → 409: Git Repository is empty.",
        ),
      ),
      true,
    );
    assert.equal(
      errorLogs.some((line) => line.includes("GitHub backup API failed")),
      false,
    );
    assert.equal(errorLogs.join("\n").includes("github_pat_test_secret_value"), false);

    urls.length = 0;
    errorLogs.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const url = String(input);
      if (url.endsWith("/oyon-backups/media/objects/products/frame.jpg")) {
        return new Response("bad request", { status: 400 });
      }
      if (url.endsWith("/oyon-backups/media/objects/products/missing.jpg")) {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith("/lumina-media/products/frame.jpg")) {
        return new Response("live-bytes", {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (url.endsWith("/oyon-backups/media/objects/products/broken.jpg")) {
        return new Response("oops", { status: 500 });
      }
      throw new Error(`unexpected storage fetch ${url}`);
    }) as typeof fetch;

    const missingProtected400 = await downloadStorageObject(
      "oyon-backups",
      "media/objects/products/frame.jpg",
    );
    const missingProtected404 = await downloadStorageObject(
      "oyon-backups",
      "media/objects/products/missing.jpg",
    );
    const liveSource = await downloadStorageObject(
      "lumina-media",
      "products/frame.jpg",
    );
    assert.equal(missingProtected400, null);
    assert.equal(missingProtected404, null);
    assert.equal(Buffer.from(liveSource!.bytes).toString(), "live-bytes");
    await assert.rejects(
      () =>
        downloadStorageObject(
          "oyon-backups",
          "media/objects/products/broken.jpg",
        ),
      /GITHUB_BACKUP_MEDIA_DOWNLOAD_FAILED:500/,
    );

    const joinedLogs = errorLogs.join("\n");
    assert.equal(joinedLogs.includes("github_pat_test_secret_value"), false);
    assert.equal(joinedLogs.includes("sb-test-secret-key"), false);
    assert.equal(joinedLogs.includes("Bearer"), false);
    assert.equal(joinedLogs.includes("Authorization"), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalLogs;
    if (originalToken === undefined) delete process.env.GITHUB_BACKUP_TOKEN;
    else process.env.GITHUB_BACKUP_TOKEN = originalToken;
    if (originalOwner === undefined) delete process.env.GITHUB_BACKUP_OWNER;
    else process.env.GITHUB_BACKUP_OWNER = originalOwner;
    if (originalRepo === undefined) delete process.env.GITHUB_BACKUP_REPO;
    else process.env.GITHUB_BACKUP_REPO = originalRepo;
    if (originalBranch === undefined) delete process.env.GITHUB_BACKUP_BRANCH;
    else process.env.GITHUB_BACKUP_BRANCH = originalBranch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSupabaseKey;
  }

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
        probeStopsBeforeMedia: true,
        firstRunMissingFilesOk: true,
        storage400FallsBackToLive: true,
        expectedGithub404Quiet: true,
        existingMainPatchesRef: true,
        emptyRepoContentsBootstrap: true,
        github409NotCreateMain: true,
        diagnosticsRedactToken: true,
      },
      null,
      2,
    ),
  );
}

void run();
