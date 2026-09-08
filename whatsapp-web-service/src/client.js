const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const { toWhatsAppChatId } = require("./phone");
const { removeStaleChromiumProfileLocks } = require("./profileLocks");
const {
  collectWhatsAppDiagnostics,
  collectBrowserSnapshot,
  collectProcessDiagnostics,
  collectRendererDiagnostics,
  fastPagePing,
  logContainerResources,
} = require("./diagnostics");

/** @type {"INITIALIZING"|"QR_REQUIRED"|"AUTHENTICATED"|"READY"|"DISCONNECTED"|"AUTH_FAILURE"} */
let connectionStatus = "INITIALIZING";
let latestQrRaw = null;
let latestQrDataUrl = null;
let qrReceivedAt = null;
let qrSeq = 0;
let lastError = null;
let client = null;
/** Client currently inside initialize(); may not yet be assigned to `client`. */
let inFlightClient = null;
/** @type {Promise<import("whatsapp-web.js").Client | null> | null} */
let startPromise = null;
let adminMutationBusy = false;
let clientGeneration = 0;
let ownedBrowserPid = null;
let staleChromiumLocksCleanedUp = false;
let pageKeepAliveTimer = null;

const MAX_INIT_ATTEMPTS = 3;
const INIT_RETRY_DELAY_MS = 4000;
const MAX_PRE_SEND_PING_ATTEMPTS = 3;
const PRE_SEND_PING_RETRY_DELAY_MS = 2500;
const RECOVERY_READY_TIMEOUT_MS = 120000;
const PAGE_KEEPALIVE_INTERVAL_MS = 20000;
const PAGE_KEEPALIVE_TIMEOUT_MS = 3000;
const DESTROY_TIMEOUT_MS = 15000;
const BROWSER_EXIT_WAIT_MS = 15000;
const BROWSER_TERM_WAIT_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableInitError(error) {
  const message = sanitizeError(
    error instanceof Error ? error.message : String(error),
  );

  return (
    /execution context was destroyed/i.test(message) ||
    /context was destroyed/i.test(message) ||
    /frame was detached/i.test(message) ||
    /target closed/i.test(message) ||
    /cannot find context with specified id/i.test(message) ||
    /protocol error \(runtime\.callfunctionon\)/i.test(message)
  );
}

/** Railway essentials + conservative memory caps (no renderer-risky flags). */
const PUPPETEER_CHROMIUM_ARGS = [
  // Required in Railway/Docker
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  // Headless: skip GPU process (standard with Puppeteer Chrome for Testing)
  "--disable-gpu",
  // One-time / audio cruft
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  // Cap disk/media caches to reduce memory-mapped RSS
  "--disk-cache-size=33554432",
  "--media-cache-size=4194304",
  // Standard Docker headless pairing with --disable-gpu; avoids extra zygote process
  "--no-zygote",
];

function getStatusPayload() {
  return {
    status: connectionStatus,
    ready: connectionStatus === "READY",
    hasQr: Boolean(latestQrRaw),
    lastError: lastError ? sanitizeError(lastError) : null,
    authDataPath: config.authDataPath,
  };
}

function getQrPayload() {
  return {
    status: connectionStatus,
    qr: latestQrRaw,
    qrDataUrl: latestQrDataUrl,
    qrReceivedAt,
    generatedAt: qrReceivedAt,
  };
}

function sanitizeError(message) {
  return String(message || "Unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .slice(0, 500);
}

async function setQr(rawQr) {
  const seq = ++qrSeq;
  latestQrRaw = rawQr;
  qrReceivedAt = new Date().toISOString();
  try {
    const dataUrl = await qrcode.toDataURL(rawQr, {
      margin: 1,
      width: 320,
    });
    if (seq === qrSeq) {
      latestQrDataUrl = dataUrl;
    }
  } catch (error) {
    if (seq === qrSeq) {
      latestQrDataUrl = null;
    }
    console.error("[whatsapp-web] failed to render QR data URL", {
      error: sanitizeError(error instanceof Error ? error.message : error),
    });
  }
}

function clearQr() {
  qrSeq += 1;
  latestQrRaw = null;
  latestQrDataUrl = null;
  qrReceivedAt = null;
}

function ensureAuthDirectory() {
  fs.mkdirSync(path.resolve(config.authDataPath), { recursive: true });
}

/** LocalAuth default folder when clientId is unset: `{dataPath}/session`. */
const LOCAL_AUTH_SESSION_DIR_NAME = "session";

function getOwnedLocalAuthSessionDir() {
  const root = path.resolve(config.authDataPath);
  const sessionDir = path.resolve(root, LOCAL_AUTH_SESSION_DIR_NAME);
  const relative = path.relative(root, sessionDir);
  if (
    !relative ||
    relative === "." ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative !== LOCAL_AUTH_SESSION_DIR_NAME
  ) {
    throw new Error("Refusing to clear a session directory outside LocalAuth data path");
  }
  return sessionDir;
}

function isOwnedLocalAuthSessionDir(candidate) {
  if (!candidate) {
    return false;
  }
  const root = path.resolve(config.authDataPath);
  const target = path.resolve(candidate);
  const relative = path.relative(root, target);
  return (
    Boolean(relative) &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    (relative === LOCAL_AUTH_SESSION_DIR_NAME ||
      relative.startsWith(`${LOCAL_AUTH_SESSION_DIR_NAME}-`))
  );
}

async function logoutOwnedLocalAuth(activeClient) {
  const strategy = activeClient?.authStrategy;
  if (!strategy || typeof strategy.logout !== "function") {
    return;
  }
  if (!isOwnedLocalAuthSessionDir(strategy.userDataDir)) {
    return;
  }
  try {
    await strategy.logout();
  } catch (error) {
    console.warn("[whatsapp-web] LocalAuth logout failed; will remove session directory", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }
}

async function removeOwnedLocalAuthSession() {
  const sessionDir = getOwnedLocalAuthSessionDir();
  await fs.promises.rm(sessionDir, {
    recursive: true,
    force: true,
    maxRetries: 4,
  });
  console.info("[whatsapp-web] cleared owned LocalAuth session");
}

function readOwnedBrowserPid(activeClient) {
  try {
    const browser = activeClient?.pupBrowser;
    const browserProcess =
      browser && typeof browser.process === "function" ? browser.process() : null;
    const pid = browserProcess?.pid ?? null;
    if (!pid || pid === process.pid) {
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

function rememberOwnedBrowserPid(activeClient) {
  const pid = readOwnedBrowserPid(activeClient);
  if (pid) {
    ownedBrowserPid = pid;
  }
  return ownedBrowserPid;
}

function isProcessAlive(pid) {
  if (!pid || pid === process.pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForOwnedBrowserExit(pid, timeoutMs = BROWSER_EXIT_WAIT_MS) {
  if (!pid || pid === process.pid) {
    return true;
  }
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      if (ownedBrowserPid === pid) {
        ownedBrowserPid = null;
      }
      return true;
    }
    await sleep(150);
  }
  return !isProcessAlive(pid);
}

async function destroyClientAndWait(activeClient) {
  stopPageKeepAlive();
  if (!activeClient) {
    if (ownedBrowserPid) {
      await waitForOwnedBrowserExit(ownedBrowserPid);
    }
    return;
  }

  const pid = rememberOwnedBrowserPid(activeClient) || ownedBrowserPid;

  try {
    if (typeof activeClient.removeAllListeners === "function") {
      activeClient.removeAllListeners();
    }
  } catch {
    // Ignore listener cleanup failures.
  }

  try {
    if (activeClient.pupBrowser && typeof activeClient.pupBrowser.close === "function") {
      await Promise.race([
        activeClient.pupBrowser.close(),
        sleep(DESTROY_TIMEOUT_MS),
      ]);
    }
  } catch (error) {
    console.warn("[whatsapp-web] browser close failed", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }

  try {
    if (typeof activeClient.destroy === "function") {
      await Promise.race([activeClient.destroy(), sleep(DESTROY_TIMEOUT_MS)]);
    }
  } catch (error) {
    console.warn("[whatsapp-web] failed to destroy client", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }

  let exited = await waitForOwnedBrowserExit(pid, BROWSER_EXIT_WAIT_MS);
  if (!exited && pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may have exited between the check and the signal.
    }
    exited = await waitForOwnedBrowserExit(pid, BROWSER_TERM_WAIT_MS);
  }

  if (!exited && pid && isProcessAlive(pid)) {
    console.warn("[whatsapp-web] owned Chromium still running after destroy");
  }

  if (inFlightClient === activeClient) {
    inFlightClient = null;
  }
  if (client === activeClient) {
    client = null;
  }
}

async function waitForFreshQr(timeoutMs, previousReceivedAt) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (connectionStatus === "READY") {
      return true;
    }
    if (
      latestQrDataUrl &&
      qrReceivedAt &&
      qrReceivedAt !== previousReceivedAt
    ) {
      return true;
    }
    await sleep(250);
  }
  return false;
}

async function cleanupStaleChromiumLocksOnce() {
  if (staleChromiumLocksCleanedUp) {
    return;
  }

  staleChromiumLocksCleanedUp = true;

  const removed = await removeStaleChromiumProfileLocks(config.authDataPath);
  if (removed.length === 0) {
    console.info("[whatsapp-web] no stale Chromium profile locks found at startup", {
      authDataPath: config.authDataPath,
    });
    return;
  }

  console.info("[whatsapp-web] removed stale Chromium profile locks before startup", {
    authDataPath: config.authDataPath,
    removedFiles: [...new Set(removed)],
    count: removed.length,
  });
}

function buildPuppeteerConfig() {
  const puppeteer = {
    headless: config.puppeteerHeadlessMode,
    // Smaller viewport reduces renderer compositor/layer memory (~603 MB observed).
    defaultViewport: { width: 1280, height: 720 },
    protocolTimeout: config.protocolTimeoutMs,
    args: PUPPETEER_CHROMIUM_ARGS,
  };

  // Optional override for local debugging only. Production uses Puppeteer's
  // bundled Chrome for Testing from PUPPETEER_CACHE_DIR.
  if (config.puppeteerExecutablePath) {
    puppeteer.executablePath = config.puppeteerExecutablePath;
  }

  return puppeteer;
}

function buildWhatsAppClientOptions() {
  const options = {
    authStrategy: new LocalAuth({
      dataPath: path.resolve(config.authDataPath),
    }),
    puppeteer: buildPuppeteerConfig(),
  };

  if (config.whatsappWebCacheMode === "pinned") {
    options.webVersion = config.whatsappWebVersion;
    options.webVersionCache = {
      type: "local",
      path: config.whatsappWebCachePath,
      strict: true,
    };
  }

  return options;
}

function stopPageKeepAlive() {
  if (pageKeepAliveTimer) {
    clearInterval(pageKeepAliveTimer);
    pageKeepAliveTimer = null;
  }
}

function startPageKeepAlive(activeClient) {
  stopPageKeepAlive();

  pageKeepAliveTimer = setInterval(() => {
    void (async () => {
      if (
        connectionStatus !== "READY" ||
        !activeClient?.pupPage ||
        activeClient.pupPage.isClosed()
      ) {
        return;
      }

      const ping = await fastPagePing(activeClient, PAGE_KEEPALIVE_TIMEOUT_MS);
      if (!ping.responsive) {
        const renderer = await collectRendererDiagnostics(activeClient);
        logContainerResources(activeClient, "keepalive-failure");
        console.warn("[whatsapp-web] page keepalive unresponsive", {
          durationMs: ping.durationMs,
          error: ping.error,
          cacheMode: config.whatsappWebCacheMode,
          renderer,
        });
      }
    })();
  }, PAGE_KEEPALIVE_INTERVAL_MS);
}

async function logBrowserSnapshot(activeClient, label) {
  const snapshot = await collectBrowserSnapshot(activeClient);
  logContainerResources(activeClient, label);
  console.info("[whatsapp-web] browser snapshot", {
    label,
    ...snapshot,
  });
  return snapshot;
}

async function pruneExtraBrowserPages(activeClient) {
  const browser = activeClient?.pupBrowser;
  const mainPage = activeClient?.pupPage;
  if (!browser || !mainPage) {
    return 0;
  }

  const pages = await browser.pages();
  let closedCount = 0;

  for (const page of pages) {
    if (page === mainPage || page.isClosed()) {
      continue;
    }

    const url = page.url();
    console.warn("[whatsapp-web] closing unexpected browser page", {
      url,
    });
    await page.close().catch(() => {});
    closedCount += 1;
  }

  return closedCount;
}

function getResolvedBrowserInfo() {
  if (config.puppeteerExecutablePath) {
    return {
      source: "PUPPETEER_EXECUTABLE_PATH",
      executablePath: config.puppeteerExecutablePath,
    };
  }

  try {
    const puppeteer = require("puppeteer");
    return {
      source: "puppeteer-cache",
      executablePath: puppeteer.executablePath(),
    };
  } catch (error) {
    return {
      source: "unknown",
      executablePath: null,
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    };
  }
}

function withTimeout(promise, timeoutMs, timeoutMessage, statusCode = 504) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.statusCode = statusCode;
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function normalizeSendError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("Runtime.callFunctionOn timed out") ||
    message.includes("protocolTimeout")
  ) {
    const timeoutError = new Error("WhatsApp Web did not respond in time");
    timeoutError.statusCode = 504;
    return timeoutError;
  }

  return error;
}

function attachClientEvents(activeClient, generation) {
  activeClient.on("qr", async (qr) => {
    if (
      generation !== clientGeneration ||
      (inFlightClient !== activeClient && client !== activeClient)
    ) {
      return;
    }
    rememberOwnedBrowserPid(activeClient);
    connectionStatus = "QR_REQUIRED";
    lastError = null;
    await setQr(qr);
    console.info("[whatsapp-web] QR_RECEIVED");
  });

  activeClient.on("authenticated", () => {
    if (generation !== clientGeneration) {
      return;
    }
    connectionStatus = "AUTHENTICATED";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] AUTHENTICATED");
  });

  activeClient.on("ready", async () => {
    if (generation !== clientGeneration) {
      return;
    }
    if (inFlightClient !== activeClient && client !== activeClient) {
      return;
    }
    client = activeClient;
    inFlightClient = null;
    connectionStatus = "READY";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] READY", {
      cacheMode: config.whatsappWebCacheMode,
    });
    await pruneExtraBrowserPages(activeClient);
    await logBrowserSnapshot(activeClient, "ready");
    logContainerResources(activeClient, "ready");

    const immediatePing = await fastPagePing(activeClient, PAGE_KEEPALIVE_TIMEOUT_MS);
    const rendererAtReady = await collectRendererDiagnostics(activeClient);
    console.info("[whatsapp-web] post-ready health", {
      responsive: immediatePing.responsive,
      ping: immediatePing.ping,
      durationMs: immediatePing.durationMs,
      error: immediatePing.error,
      loadedWebVersion: rendererAtReady.loadedWebVersion,
      loadedWebVersionError: rendererAtReady.loadedWebVersionError,
      cacheMode: config.whatsappWebCacheMode,
      chromeProcessCount: rendererAtReady.chromeProcessTree?.processCount ?? 0,
      ...collectProcessDiagnostics(activeClient),
    });

    startPageKeepAlive(activeClient);
  });

  activeClient.on("disconnected", (reason) => {
    if (generation !== clientGeneration) {
      return;
    }
    stopPageKeepAlive();
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(reason || "disconnected");
    clearQr();
    console.warn("[whatsapp-web] DISCONNECTED", { reason: lastError });
  });

  activeClient.on("auth_failure", (message) => {
    if (generation !== clientGeneration) {
      return;
    }
    connectionStatus = "AUTH_FAILURE";
    lastError = sanitizeError(message || "auth_failure");
    clearQr();
    console.error("[whatsapp-web] AUTH_FAILURE", {
      error: lastError,
    });
  });
}

async function stopCurrentClient({ clearSession = false } = {}) {
  clientGeneration += 1;
  stopPageKeepAlive();
  clearQr();
  lastError = null;
  connectionStatus = "INITIALIZING";

  const target = inFlightClient || client;
  await destroyClientAndWait(target);

  if (startPromise) {
    try {
      await startPromise;
    } catch {
      // The interrupted initialize() is expected to reject.
    }
  }

  client = null;
  inFlightClient = null;
  startPromise = null;
  ownedBrowserPid = isProcessAlive(ownedBrowserPid) ? ownedBrowserPid : null;
  if (ownedBrowserPid) {
    await waitForOwnedBrowserExit(ownedBrowserPid);
  }

  if (clearSession) {
    await logoutOwnedLocalAuth(target);
    await removeOwnedLocalAuthSession();
  }

  staleChromiumLocksCleanedUp = false;
}

async function initializeWhatsAppClient() {
  if (client) {
    return client;
  }
  if (startPromise) {
    return startPromise;
  }
  if (adminMutationBusy) {
    while (adminMutationBusy && !client && !startPromise) {
      await sleep(50);
    }
    if (client) {
      return client;
    }
    if (startPromise) {
      return startPromise;
    }
  }
  return startFreshClient();
}

async function startFreshClient() {
  if (startPromise) {
    return startPromise;
  }

  const generation = clientGeneration;
  startPromise = (async () => {
    if (inFlightClient || client) {
      throw new Error("Refusing to initialize while another WhatsApp client is active");
    }

    connectionStatus = "INITIALIZING";
    lastError = null;
    ensureAuthDirectory();
    await cleanupStaleChromiumLocksOnce();

    const browserInfo = getResolvedBrowserInfo();
    console.info("[whatsapp-web] launching browser", {
      source: browserInfo.source,
      headlessMode: config.puppeteerHeadlessMode,
      cacheDir: process.env.PUPPETEER_CACHE_DIR || null,
      cacheMode: config.whatsappWebCacheMode,
      webVersion: config.whatsappWebCacheMode === "pinned"
        ? config.whatsappWebVersion
        : "live (web.whatsapp.com)",
      webVersionCachePath: config.whatsappWebCachePath,
    });

    let lastInitError = null;

    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt += 1) {
      if (generation !== clientGeneration) {
        return null;
      }

      connectionStatus = "INITIALIZING";
      console.info("[whatsapp-web] initialization attempt", {
        attempt,
        maxAttempts: MAX_INIT_ATTEMPTS,
        generation,
      });

      const activeClient = new Client(buildWhatsAppClientOptions());
      inFlightClient = activeClient;
      attachClientEvents(activeClient, generation);

      try {
        const initializePromise = activeClient.initialize();
        const pidPoll = (async () => {
          while (generation === clientGeneration && inFlightClient === activeClient) {
            rememberOwnedBrowserPid(activeClient);
            if (ownedBrowserPid) {
              return;
            }
            await sleep(250);
          }
        })();
        await initializePromise;
        await Promise.race([pidPoll, sleep(10)]);
        rememberOwnedBrowserPid(activeClient);

        if (generation !== clientGeneration) {
          await destroyClientAndWait(activeClient);
          return null;
        }

        await pruneExtraBrowserPages(activeClient);
        client = activeClient;
        inFlightClient = null;

        console.info("[whatsapp-web] initialization succeeded", {
          attempt,
          cacheMode: config.whatsappWebCacheMode,
          webVersion: config.whatsappWebCacheMode === "pinned"
            ? config.whatsappWebVersion
            : "live (web.whatsapp.com)",
        });
        return activeClient;
      } catch (error) {
        lastInitError = error;
        const detail = sanitizeError(
          error instanceof Error ? error.message : String(error),
        );
        console.error("[whatsapp-web] initialization failed", {
          attempt,
          generation,
          error: detail,
        });

        await destroyClientAndWait(activeClient);
        if (inFlightClient === activeClient) {
          inFlightClient = null;
        }

        const shouldRetry =
          attempt < MAX_INIT_ATTEMPTS &&
          generation === clientGeneration &&
          isRetryableInitError(error);
        if (!shouldRetry) {
          break;
        }

        console.warn("[whatsapp-web] retry scheduled", {
          attempt,
          nextAttempt: attempt + 1,
          delayMs: INIT_RETRY_DELAY_MS,
          reason: detail,
        });
        await sleep(INIT_RETRY_DELAY_MS);
      }
    }

    if (generation === clientGeneration) {
      connectionStatus = "DISCONNECTED";
      lastError = sanitizeError(
        lastInitError instanceof Error ? lastInitError.message : String(lastInitError),
      );
      console.error("[whatsapp-web] initialization exhausted retries", {
        attempts: MAX_INIT_ATTEMPTS,
        error: lastError,
      });
    }

    return null;
  })();

  try {
    return await startPromise;
  } finally {
    if (startPromise) {
      startPromise = null;
    }
  }
}

/**
 * Restart the WhatsApp Web client to request a new pairing QR.
 * Does not delete LocalAuth/session files. Refuses when already READY.
 */
async function reconnectWhatsAppClient() {
  if (connectionStatus === "READY") {
    return { ok: false, refused: true, inProgress: false, status: "READY" };
  }

  if (adminMutationBusy) {
    return {
      ok: false,
      refused: false,
      inProgress: true,
      status: connectionStatus,
    };
  }

  adminMutationBusy = true;
  const previousReceivedAt = qrReceivedAt;
  try {
    await stopCurrentClient({ clearSession: false });
    void startFreshClient();
    const recovered = await waitForFreshQr(45000, previousReceivedAt);
    return {
      ok: recovered,
      refused: false,
      inProgress: false,
      status: connectionStatus,
    };
  } catch (error) {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    console.warn("[whatsapp-web] reconnect failed", { error: lastError });
    return {
      ok: false,
      refused: false,
      inProgress: false,
      status: connectionStatus,
    };
  } finally {
    adminMutationBusy = false;
  }
}

/**
 * Explicit pairing reset: destroy the client, remove only this service's
 * LocalAuth session directory, then start a new client. Never automatic.
 */
async function resetWhatsAppSession() {
  if (connectionStatus === "READY") {
    return { ok: false, refused: true, inProgress: false, status: "READY" };
  }

  if (adminMutationBusy) {
    return {
      ok: false,
      refused: false,
      inProgress: true,
      status: connectionStatus,
    };
  }

  adminMutationBusy = true;
  const previousReceivedAt = qrReceivedAt;
  try {
    await stopCurrentClient({ clearSession: true });
    void startFreshClient();
    const recovered = await waitForFreshQr(45000, previousReceivedAt);
    return {
      ok: recovered,
      refused: false,
      inProgress: false,
      status: connectionStatus,
    };
  } catch (error) {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    console.warn("[whatsapp-web] session reset failed", { error: lastError });
    return {
      ok: false,
      refused: false,
      inProgress: false,
      status: connectionStatus,
    };
  } finally {
    adminMutationBusy = false;
  }
}

async function waitForReady(activeClient, timeoutMs) {
  if (connectionStatus === "READY") {
    return;
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Timed out waiting for READY after recovery (status: ${connectionStatus})`,
        ),
      );
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      activeClient.removeListener("ready", onReady);
    };

    if (connectionStatus === "READY") {
      cleanup();
      resolve();
      return;
    }

    activeClient.on("ready", onReady);
  });
}

async function performControlledRecovery() {
  if (adminMutationBusy) {
    const error = new Error("WhatsApp client lifecycle is busy");
    error.statusCode = 503;
    throw error;
  }

  logContainerResources(client, "recovery-before");
  console.warn("[whatsapp-web] recovery started");

  await stopCurrentClient({ clearSession: false });
  const recoveredClient = await startFreshClient();
  if (!recoveredClient) {
    const error = new Error("Controlled recovery failed to initialize client");
    error.statusCode = 503;
    throw error;
  }

  await waitForReady(recoveredClient, RECOVERY_READY_TIMEOUT_MS);
  console.info("[whatsapp-web] recovery READY");

  return recoveredClient;
}

async function ensurePageResponsiveForSend(activeClient, options = {}) {
  const maxAttempts = options.maxAttempts || MAX_PRE_SEND_PING_ATTEMPTS;
  const allowRecovery = options.allowRecovery !== false;
  let currentClient = activeClient;
  let lastPing = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.info("[whatsapp-web] pre-send health attempt", {
      attempt,
      maxAttempts,
    });

    lastPing = await fastPagePing(currentClient);
    console.info("[whatsapp-web] page responsive check", {
      attempt,
      maxAttempts,
      responsive: lastPing.responsive ? "responsive" : "unresponsive",
      ping: lastPing.ping,
      durationMs: lastPing.durationMs,
      error: lastPing.error,
      ...collectProcessDiagnostics(currentClient),
    });

    if (lastPing.responsive) {
      return { activeClient: currentClient, recovered: false };
    }

    if (attempt < maxAttempts) {
      await sleep(PRE_SEND_PING_RETRY_DELAY_MS);
    }
  }

  if (!allowRecovery) {
    const error = new Error(
      "WhatsApp Web page is not responsive; refusing to send",
    );
    error.statusCode = 503;
    throw error;
  }

  currentClient = await performControlledRecovery();
  lastPing = await fastPagePing(currentClient);

  console.info("[whatsapp-web] page responsive check", {
    attempt: "post-recovery",
    responsive: lastPing.responsive ? "responsive" : "unresponsive",
    ping: lastPing.ping,
    durationMs: lastPing.durationMs,
    error: lastPing.error,
    ...collectProcessDiagnostics(currentClient),
  });

  if (!lastPing.responsive) {
    const error = new Error(
      "WhatsApp Web page is not responsive; refusing to send",
    );
    error.statusCode = 503;
    throw error;
  }

  return { activeClient: currentClient, recovered: true };
}

async function getDiagnosticsPayload() {
  const activeClient = await initializeWhatsAppClient();
  return collectWhatsAppDiagnostics(activeClient, connectionStatus);
}

async function sendTextMessage(to, message) {
  const activeClient = await initializeWhatsAppClient();

  if (!activeClient || connectionStatus !== "READY") {
    const error = new Error(
      `WhatsApp client is not ready (status: ${connectionStatus})`,
    );
    error.statusCode = 503;
    throw error;
  }

  const chatId = toWhatsAppChatId(to);
  if (!chatId) {
    const error = new Error("Invalid Israeli WhatsApp recipient number");
    error.statusCode = 400;
    throw error;
  }

  const text = String(message || "").trim();
  if (!text) {
    const error = new Error("Message text is required");
    error.statusCode = 400;
    throw error;
  }

  const startedAt = Date.now();
  logContainerResources(activeClient, "send-before");
  console.info("[whatsapp-web] send started", {
    messageLength: text.length,
    timeoutMs: config.sendMessageTimeoutMs,
    ...collectProcessDiagnostics(activeClient),
  });

  try {
    let activeClientForSend = activeClient;
    const health = await ensurePageResponsiveForSend(activeClientForSend, {
      allowRecovery: true,
    });
    activeClientForSend = health.activeClient;

    console.info("[whatsapp-web] sendMessage started", {
      messageLength: text.length,
      recovered: Boolean(health.recovered),
      ...collectProcessDiagnostics(activeClientForSend),
    });

    const result = await withTimeout(
      activeClientForSend.sendMessage(chatId, text),
      config.sendMessageTimeoutMs,
      "WhatsApp Web did not respond in time",
      504,
    );

    await logBrowserSnapshot(activeClientForSend, "send-complete");
    logContainerResources(activeClientForSend, "send-after");

    console.info("[whatsapp-web] sendMessage succeeded", {
      durationMs: Date.now() - startedAt,
      messageLength: text.length,
    });

    return {
      chatId,
      messageId: result?.id?._serialized || result?.id || null,
    };
  } catch (error) {
    logContainerResources(activeClient, "send-after-failure");
    const normalizedError = normalizeSendError(error);
    console.error("[whatsapp-web] sendMessage failed", {
      durationMs: Date.now() - startedAt,
      statusCode: normalizedError.statusCode || 500,
      error: sanitizeError(
        normalizedError instanceof Error
          ? normalizedError.message
          : String(normalizedError),
      ),
    });
    throw normalizedError;
  }
}

module.exports = {
  initializeWhatsAppClient,
  reconnectWhatsAppClient,
  resetWhatsAppSession,
  sendTextMessage,
  getStatusPayload,
  getQrPayload,
  getDiagnosticsPayload,
};
