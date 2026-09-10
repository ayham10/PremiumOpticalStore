const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const {
  installWhatsAppWebJsGuards,
  wrapClientInject,
  lockClientInject,
  installProcessErrorBoundary,
} = require("./wwebjsGuard");

installWhatsAppWebJsGuards();
installProcessErrorBoundary();

const { Client } = require("whatsapp-web.js");
wrapClientInject(Client);
const config = require("./config");
const { toWhatsAppChatId } = require("./phone");
const { removeStaleChromiumProfileLocks } = require("./profileLocks");
const { PreserveLocalAuth } = require("./localAuth");
const {
  sanitizeError,
  isRetryableInitError,
  isGenuineWhatsAppLogout,
  isLogoutNavigationUrl,
  classifyWhatsAppSendability,
  isBrowserDisconnectReason,
  isCurrentClientEvent,
  createMutex,
  createRecoveryBudget,
} = require("./lifecycle");
const {
  collectWhatsAppDiagnostics,
  collectBrowserSnapshot,
  collectProcessDiagnostics,
  collectRendererDiagnostics,
  fastPagePing,
  checkWhatsAppSendable,
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
let holdNewClient = false;
let clientGeneration = 0;
let ownedBrowserPid = null;
let staleChromiumLocksCleanedUp = false;
let pageKeepAliveTimer = null;
let tearingDown = false;
let keepaliveFailures = 0;
let recoveryPromise = null;
const lifecycleMutex = createMutex();
const recoveryBudget = createRecoveryBudget();

const MAX_INIT_ATTEMPTS = 3;
const INIT_RETRY_DELAY_MS = 4000;
const MAX_PRE_SEND_PING_ATTEMPTS = 3;
const PRE_SEND_PING_RETRY_DELAY_MS = 2500;
const RECOVERY_READY_TIMEOUT_MS = 120000;
const PAGE_KEEPALIVE_INTERVAL_MS = 20000;
const PAGE_KEEPALIVE_TIMEOUT_MS = 3000;
const KEEPALIVE_FAILURES_BEFORE_RECOVERY = 3;
const DESTROY_TIMEOUT_MS = 15000;
const BROWSER_EXIT_WAIT_MS = 15000;
const BROWSER_TERM_WAIT_MS = 5000;
const BROWSER_KILL_WAIT_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentClientRef() {
  return {
    generation: clientGeneration,
    client,
    inFlightClient,
  };
}

function isLiveClient(activeClient, generation) {
  return isCurrentClientEvent(
    { client: activeClient, generation },
    currentClientRef(),
  );
}

function logLifecycle(level, event, extra = {}) {
  const payload = {
    event,
    generation: clientGeneration,
    chromiumPid: ownedBrowserPid,
    localAuthPreserved: extra.localAuthPreserved !== false,
    status: connectionStatus,
    ...extra,
  };
  if (level === "error") {
    console.error("[whatsapp-web]", payload);
    return;
  }
  if (level === "warn") {
    console.warn("[whatsapp-web]", payload);
    return;
  }
  console.info("[whatsapp-web]", payload);
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
  if (typeof strategy.allowSessionDelete === "function") {
    strategy.allowSessionDelete();
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

function signalOwnedBrowser(pid, signal) {
  if (!pid || pid === process.pid || !isProcessAlive(pid)) {
    return false;
  }
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function terminateOwnedBrowser(pid, { allowKill = true } = {}) {
  if (!pid || pid === process.pid) {
    return { pid: pid || null, terminated: true, signal: null };
  }

  let terminated = await waitForOwnedBrowserExit(pid, BROWSER_EXIT_WAIT_MS);
  if (terminated) {
    return { pid, terminated: true, signal: null };
  }

  logLifecycle("warn", "chromium-term", { pid, signal: "SIGTERM" });
  signalOwnedBrowser(pid, "SIGTERM");
  terminated = await waitForOwnedBrowserExit(pid, BROWSER_TERM_WAIT_MS);
  if (terminated) {
    return { pid, terminated: true, signal: "SIGTERM" };
  }

  if (allowKill) {
    logLifecycle("warn", "chromium-kill", { pid, signal: "SIGKILL" });
    signalOwnedBrowser(pid, "SIGKILL");
    terminated = await waitForOwnedBrowserExit(pid, BROWSER_KILL_WAIT_MS);
  }

  return { pid, terminated, signal: allowKill ? "SIGKILL" : "SIGTERM" };
}

async function destroyClientAndWait(activeClient) {
  stopPageKeepAlive();
  tearingDown = true;
  lockClientInject(activeClient);
  if (!activeClient) {
    const leftover = ownedBrowserPid;
    if (leftover) {
      const result = await terminateOwnedBrowser(leftover);
      logLifecycle(result.terminated ? "info" : "warn", "chromium-exit", {
        pid: leftover,
        terminated: result.terminated,
        signal: result.signal,
        localAuthPreserved: true,
      });
    }
    tearingDown = false;
    return !ownedBrowserPid || !isProcessAlive(ownedBrowserPid);
  }

  const pid = rememberOwnedBrowserPid(activeClient) || ownedBrowserPid;
  logLifecycle("info", "client-destroy-start", {
    pid,
    localAuthPreserved: true,
  });

  try {
    if (typeof activeClient.removeAllListeners === "function") {
      activeClient.removeAllListeners();
    }
  } catch {
    // Ignore listener cleanup failures.
  }

  try {
    const page = activeClient.pupPage;
    if (page && typeof page.removeAllListeners === "function") {
      page.removeAllListeners("framenavigated");
    }
  } catch {
    // Page may already be closed.
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

  const termination = await terminateOwnedBrowser(pid);
  if (!termination.terminated && pid && isProcessAlive(pid)) {
    logLifecycle("error", "chromium-still-running", {
      pid,
      localAuthPreserved: true,
    });
  } else {
    logLifecycle("info", "chromium-exit", {
      pid,
      terminated: termination.terminated,
      signal: termination.signal,
      localAuthPreserved: true,
    });
  }

  if (inFlightClient === activeClient) {
    inFlightClient = null;
  }
  if (client === activeClient) {
    client = null;
  }
  tearingDown = false;
  return termination.terminated;
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
    authStrategy: new PreserveLocalAuth({
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

function startPageKeepAlive(activeClient, generation) {
  stopPageKeepAlive();
  keepaliveFailures = 0;

  pageKeepAliveTimer = setInterval(() => {
    void (async () => {
      if (!isLiveClient(activeClient, generation)) {
        return;
      }
      if (
        connectionStatus !== "READY" ||
        !activeClient?.pupPage ||
        activeClient.pupPage.isClosed()
      ) {
        return;
      }
      if (lifecycleMutex.locked || recoveryPromise) {
        return;
      }

      const health = await checkWhatsAppSendable(
        activeClient,
        PAGE_KEEPALIVE_TIMEOUT_MS,
      );
      const decision = classifyWhatsAppSendability({
        pingOk: health.pingOk,
        hasGetChat: health.hasGetChat,
      });
      if (decision.allowSend) {
        keepaliveFailures = 0;
        return;
      }

      if (decision.reason === "wwebjs-missing") {
        logLifecycle("warn", "keepalive-wwebjs-missing", {
          ping: health.ping,
          durationMs: health.durationMs,
          error: health.error,
        });
        if (connectionStatus === "READY") {
          connectionStatus = "DISCONNECTED";
          lastError = health.error || "WWebJS.getChat missing";
        }
        try {
          await performControlledRecovery("keepalive-wwebjs-missing");
        } catch (error) {
          logLifecycle("error", "keepalive-recovery-failed", {
            error: sanitizeError(
              error instanceof Error ? error.message : String(error),
            ),
          });
        }
        return;
      }

      keepaliveFailures += 1;
      const renderer = await collectRendererDiagnostics(activeClient);
      logContainerResources(activeClient, "keepalive-failure");
      logLifecycle("warn", "keepalive-unresponsive", {
        durationMs: health.durationMs,
        error: health.error,
        failures: keepaliveFailures,
        cacheMode: config.whatsappWebCacheMode,
        rendererBrowserConnected: renderer.browserConnected,
        rendererProcessRunning: renderer.browserProcessRunning,
      });

      if (keepaliveFailures < KEEPALIVE_FAILURES_BEFORE_RECOVERY) {
        return;
      }

      keepaliveFailures = 0;
      try {
        await performControlledRecovery("keepalive-unresponsive");
      } catch (error) {
        logLifecycle("error", "keepalive-recovery-failed", {
          error: sanitizeError(
            error instanceof Error ? error.message : String(error),
          ),
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
    if (!isLiveClient(activeClient, generation)) {
      return;
    }
    rememberOwnedBrowserPid(activeClient);
    connectionStatus = "QR_REQUIRED";
    lastError = null;
    await setQr(qr);
    logLifecycle("info", "QR_REQUIRED", { localAuthPreserved: true });
  });

  activeClient.on("authenticated", () => {
    if (!isLiveClient(activeClient, generation)) {
      return;
    }
    connectionStatus = "AUTHENTICATED";
    lastError = null;
    clearQr();
    logLifecycle("info", "AUTHENTICATED", { localAuthPreserved: true });
  });

  activeClient.on("ready", async () => {
    if (!isLiveClient(activeClient, generation)) {
      return;
    }
    client = activeClient;
    inFlightClient = null;
    connectionStatus = "READY";
    lastError = null;
    clearQr();
    logLifecycle("info", "READY", {
      cacheMode: config.whatsappWebCacheMode,
      localAuthPreserved: true,
    });
    await pruneExtraBrowserPages(activeClient);
    await logBrowserSnapshot(activeClient, "ready");
    logContainerResources(activeClient, "ready");

    const immediatePing = await fastPagePing(activeClient, PAGE_KEEPALIVE_TIMEOUT_MS);
    const rendererAtReady = await collectRendererDiagnostics(activeClient);
    console.info("[whatsapp-web] post-ready health", {
      generation: clientGeneration,
      chromiumPid: ownedBrowserPid,
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
    disarmLibraryReinjection(activeClient, generation);
    startPageKeepAlive(activeClient, generation);
  });

  activeClient.on("disconnected", (reason) => {
    if (tearingDown) {
      logLifecycle("info", "disconnected-during-teardown", {
        reason: sanitizeError(reason || "disconnected"),
        localAuthPreserved: true,
      });
      return;
    }
    if (!isLiveClient(activeClient, generation)) {
      return;
    }
    stopPageKeepAlive();
    const detail = sanitizeError(reason || "disconnected");
    lastError = detail;

    if (isGenuineWhatsAppLogout(reason)) {
      void retireClientAfterWhatsAppLogout(activeClient, generation, detail);
      return;
    }

    connectionStatus = "DISCONNECTED";
    clearQr();
    logLifecycle("warn", "DISCONNECTED", {
      reason: detail,
      browserFailure: isBrowserDisconnectReason(reason),
      localAuthPreserved: true,
    });

    if (isBrowserDisconnectReason(reason) && !holdNewClient && !adminMutationBusy) {
      void performControlledRecovery(`disconnected:${detail}`).catch((error) => {
        logLifecycle("error", "disconnect-recovery-failed", {
          error: sanitizeError(
            error instanceof Error ? error.message : String(error),
          ),
        });
      });
    }
  });

  activeClient.on("auth_failure", (message) => {
    if (!isLiveClient(activeClient, generation)) {
      return;
    }
    connectionStatus = "AUTH_FAILURE";
    lastError = sanitizeError(message || "auth_failure");
    clearQr();
    logLifecycle("error", "AUTH_FAILURE", {
      error: lastError,
      localAuthPreserved: true,
    });
  });
}

function disarmLibraryReinjection(activeClient, generation) {
  const page = activeClient?.pupPage;
  lockClientInject(activeClient);
  if (!page) {
    return;
  }
  try {
    if (typeof page.removeAllListeners === "function") {
      page.removeAllListeners("framenavigated");
    }
  } catch {
    return;
  }
  page.on("framenavigated", (frame) => {
    void onOwnedFrameNavigated(activeClient, generation, frame);
  });
}

async function onOwnedFrameNavigated(activeClient, generation, frame) {
  if (tearingDown || !isLiveClient(activeClient, generation)) {
    return;
  }
  let url = "";
  try {
    url = typeof frame?.url === "function" ? frame.url() : "";
  } catch {
    return;
  }
  if (isLogoutNavigationUrl(url) || isGenuineWhatsAppLogout(url)) {
    await retireClientAfterWhatsAppLogout(
      activeClient,
      generation,
      isLogoutNavigationUrl(url) ? "post_logout=1" : url,
    );
    return;
  }
  if (!isMainFrameNavigation(activeClient?.pupPage, frame)) {
    return;
  }
  if (holdNewClient || adminMutationBusy || recoveryPromise || lifecycleMutex.locked) {
    return;
  }
  if (connectionStatus !== "READY") {
    return;
  }

  lockClientInject(activeClient);
  connectionStatus = "DISCONNECTED";
  lastError = "WhatsApp Web navigated; recovering with a fresh client";
  logLifecycle("warn", "navigation-store-invalid", {
    localAuthPreserved: true,
  });
  try {
    await performControlledRecovery("navigation-store-invalid");
  } catch (error) {
    logLifecycle("error", "navigation-recovery-failed", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }
}

function isMainFrameNavigation(page, frame) {
  if (!page || !frame) {
    return false;
  }
  try {
    if (typeof page.mainFrame === "function" && frame === page.mainFrame()) {
      return true;
    }
  } catch {
    // Ignore CDP errors from a dying page.
  }
  try {
    if (typeof frame.parentFrame === "function" && frame.parentFrame() == null) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function retireClientAfterWhatsAppLogout(activeClient, generation, reason) {
  if (tearingDown) {
    return;
  }
  if (!isLiveClient(activeClient, generation)) {
    return;
  }

  lockClientInject(activeClient);
  stopPageKeepAlive();
  holdNewClient = true;
  connectionStatus = "QR_REQUIRED";
  lastError = sanitizeError(reason || "LOGOUT");
  logLifecycle("warn", "whatsapp-logout", {
    reason: lastError,
    localAuthPreserved: true,
  });

  try {
    await lifecycleMutex.runExclusive(async () => {
      if (generation !== clientGeneration && client !== activeClient && inFlightClient !== activeClient) {
        return;
      }
      await stopCurrentClient({ clearSession: false });
      holdNewClient = true;
      connectionStatus = "QR_REQUIRED";
      lastError = sanitizeError(reason || "LOGOUT");
    });
  } catch (error) {
    logLifecycle("error", "logout-teardown-failed", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
      localAuthPreserved: true,
    });
  }
}

async function stopCurrentClient({ clearSession = false } = {}) {
  clientGeneration += 1;
  stopPageKeepAlive();
  clearQr();
  lastError = null;
  connectionStatus = "INITIALIZING";

  const target = inFlightClient || client;
  const browserGone = await destroyClientAndWait(target);

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
    const leftover = await terminateOwnedBrowser(ownedBrowserPid);
    if (!leftover.terminated) {
      const error = new Error(
        "Owned Chromium did not exit; refusing to reuse LocalAuth userDataDir",
      );
      logLifecycle("error", "chromium-reuse-refused", {
        pid: ownedBrowserPid,
        localAuthPreserved: !clearSession,
      });
      throw error;
    }
  }

  if (clearSession) {
    await logoutOwnedLocalAuth(target);
    await removeOwnedLocalAuthSession();
    logLifecycle("info", "localauth-cleared", { localAuthPreserved: false });
  } else {
    logLifecycle("info", "localauth-preserved", { localAuthPreserved: true });
  }

  if (browserGone !== false) {
    staleChromiumLocksCleanedUp = false;
  }
}

async function initializeWhatsAppClient() {
  if (client) {
    return client;
  }
  if (holdNewClient) {
    return null;
  }
  if (startPromise) {
    return startPromise;
  }
  return lifecycleMutex.runExclusive(async () => {
    if (client) {
      return client;
    }
    if (holdNewClient) {
      return null;
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
    return startFreshClientUnlocked();
  });
}

async function startFreshClientUnlocked() {
  if (holdNewClient) {
    return null;
  }
  if (startPromise) {
    return startPromise;
  }

  const generation = clientGeneration;
  startPromise = (async () => {
    if (inFlightClient || client) {
      throw new Error("Refusing to initialize while another WhatsApp client is active");
    }
    if (ownedBrowserPid && isProcessAlive(ownedBrowserPid)) {
      throw new Error("Refusing to initialize while owned Chromium is still running");
    }

    connectionStatus = "INITIALIZING";
    lastError = null;
    ensureAuthDirectory();
    await cleanupStaleChromiumLocksOnce();

    const browserInfo = getResolvedBrowserInfo();
    logLifecycle("info", "initialization-start", {
      source: browserInfo.source,
      headlessMode: config.puppeteerHeadlessMode,
      cacheMode: config.whatsappWebCacheMode,
      webVersion: config.whatsappWebCacheMode === "pinned"
        ? config.whatsappWebVersion
        : "live (web.whatsapp.com)",
    });

    let lastInitError = null;

    for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt += 1) {
      if (generation !== clientGeneration) {
        return null;
      }

      connectionStatus = "INITIALIZING";
      logLifecycle("info", "initialization-attempt", {
        attempt,
        maxAttempts: MAX_INIT_ATTEMPTS,
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
        disarmLibraryReinjection(activeClient, generation);
        client = activeClient;
        inFlightClient = null;

        logLifecycle("info", "initialization-succeeded", {
          attempt,
          cacheMode: config.whatsappWebCacheMode,
        });
        return activeClient;
      } catch (error) {
        lastInitError = error;
        const detail = sanitizeError(
          error instanceof Error ? error.message : String(error),
        );
        logLifecycle("error", "initialization-failed", {
          attempt,
          error: detail,
        });

        await destroyClientAndWait(activeClient);
        if (inFlightClient === activeClient) {
          inFlightClient = null;
        }
        if (ownedBrowserPid && isProcessAlive(ownedBrowserPid)) {
          await terminateOwnedBrowser(ownedBrowserPid);
        }
        staleChromiumLocksCleanedUp = false;
        await cleanupStaleChromiumLocksOnce();

        const shouldRetry =
          attempt < MAX_INIT_ATTEMPTS &&
          generation === clientGeneration &&
          isRetryableInitError(error);
        if (!shouldRetry) {
          break;
        }

        logLifecycle("warn", "initialization-retry", {
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
      logLifecycle("error", "initialization-exhausted", {
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
  holdNewClient = false;
  const previousReceivedAt = qrReceivedAt;
  try {
    await lifecycleMutex.runExclusive(async () => {
      await stopCurrentClient({ clearSession: false });
      await startFreshClientUnlocked();
    });
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
async function resetWhatsAppSession(options = {}) {
  const allowReady = options.allowReady === true;
  if (connectionStatus === "READY" && !allowReady) {
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
  holdNewClient = false;
  const previousReceivedAt = qrReceivedAt;
  try {
    await lifecycleMutex.runExclusive(async () => {
      await stopCurrentClient({ clearSession: true });
      await startFreshClientUnlocked();
    });
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

async function unlinkWhatsAppClient(activeClient) {
  if (!activeClient || typeof activeClient.logout !== "function") {
    return;
  }
  try {
    await Promise.race([activeClient.logout(), sleep(20000)]);
  } catch (error) {
    console.warn("[whatsapp-web] client.logout failed", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }
}

/**
 * Unlink the live WhatsApp Web session from the phone, stop Chromium,
 * and clear LocalAuth. Does not start a new QR until Admin reconnects.
 */
async function disconnectWhatsAppSession() {
  if (connectionStatus !== "READY") {
    return {
      ok: false,
      refused: true,
      inProgress: false,
      status: connectionStatus,
    };
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
  holdNewClient = true;
  try {
    const active = client;
    await unlinkWhatsAppClient(active);
    await lifecycleMutex.runExclusive(async () => {
      await stopCurrentClient({ clearSession: true });
    });
    holdNewClient = true;
    connectionStatus = "DISCONNECTED";
    clearQr();
    lastError = null;
    return {
      ok: true,
      refused: false,
      inProgress: false,
      status: "DISCONNECTED",
    };
  } catch (error) {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    console.warn("[whatsapp-web] disconnect failed", { error: lastError });
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

async function waitForReady(activeClient, timeoutMs, generation) {
  if (connectionStatus === "READY" && isLiveClient(activeClient, generation)) {
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
      if (!isLiveClient(activeClient, generation)) {
        return;
      }
      cleanup();
      resolve();
    };

    const onTerminal = () => {
      if (!isLiveClient(activeClient, generation)) {
        return;
      }
      if (
        connectionStatus === "QR_REQUIRED" ||
        connectionStatus === "AUTH_FAILURE"
      ) {
        cleanup();
        reject(
          new Error(
            `Recovery reached ${connectionStatus} instead of READY`,
          ),
        );
      }
    };

    const poll = setInterval(() => {
      if (generation !== clientGeneration) {
        cleanup();
        reject(new Error("Recovery aborted by a newer client generation"));
        return;
      }
      if (connectionStatus === "READY" && isLiveClient(activeClient, generation)) {
        cleanup();
        resolve();
        return;
      }
      onTerminal();
    }, 250);

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(poll);
      activeClient.removeListener("ready", onReady);
    };

    if (connectionStatus === "READY" && isLiveClient(activeClient, generation)) {
      cleanup();
      resolve();
      return;
    }

    activeClient.on("ready", onReady);
  });
}

async function performControlledRecovery(reason = "unspecified") {
  if (holdNewClient) {
    const error = new Error("WhatsApp client is held after disconnect");
    error.statusCode = 503;
    throw error;
  }
  if (adminMutationBusy) {
    const error = new Error("WhatsApp client lifecycle is busy");
    error.statusCode = 503;
    throw error;
  }
  if (!recoveryBudget.canAttempt()) {
    const error = new Error(
      "WhatsApp recovery retry budget exhausted; admin reconnect required",
    );
    error.statusCode = 503;
    logLifecycle("error", "recovery-budget-exhausted", {
      reason,
      remaining: recoveryBudget.remaining(),
    });
    throw error;
  }
  if (recoveryPromise) {
    return recoveryPromise;
  }

  recoveryPromise = lifecycleMutex.runExclusive(async () => {
    const attempt = recoveryBudget.record();
    logContainerResources(client, "recovery-before");
    logLifecycle("warn", "recovery-started", {
      reason,
      attempt,
      remainingAfter: recoveryBudget.remaining(),
      localAuthPreserved: true,
      clearSession: false,
    });

    await stopCurrentClient({ clearSession: false });
    const recoveredClient = await startFreshClientUnlocked();
    if (!recoveredClient) {
      const error = new Error("Controlled recovery failed to initialize client");
      error.statusCode = 503;
      throw error;
    }

    await waitForReady(
      recoveredClient,
      RECOVERY_READY_TIMEOUT_MS,
      clientGeneration,
    );
    logLifecycle("info", "recovery-ready", {
      reason,
      attempt,
      localAuthPreserved: true,
    });

    return recoveredClient;
  }).finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
}

async function ensurePageResponsiveForSend(activeClient, options = {}) {
  const maxAttempts = options.maxAttempts || MAX_PRE_SEND_PING_ATTEMPTS;
  const allowRecovery = options.allowRecovery !== false;
  let currentClient = activeClient;
  let lastHealth = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.info("[whatsapp-web] pre-send health attempt", {
      attempt,
      maxAttempts,
    });

    lastHealth = await checkWhatsAppSendable(currentClient);
    const decision = classifyWhatsAppSendability({
      pingOk: lastHealth.pingOk,
      hasGetChat: lastHealth.hasGetChat,
    });
    console.info("[whatsapp-web] page responsive check", {
      attempt,
      maxAttempts,
      sendable: lastHealth.sendable,
      pingOk: lastHealth.pingOk,
      hasGetChat: lastHealth.hasGetChat,
      action: decision.action,
      durationMs: lastHealth.durationMs,
      error: lastHealth.error,
      ...collectProcessDiagnostics(currentClient),
    });

    if (decision.allowSend) {
      return { activeClient: currentClient, recovered: false };
    }

    if (decision.reason === "wwebjs-missing") {
      break;
    }

    if (attempt < maxAttempts) {
      await sleep(PRE_SEND_PING_RETRY_DELAY_MS);
    }
  }

  const decision = classifyWhatsAppSendability({
    pingOk: lastHealth?.pingOk,
    hasGetChat: lastHealth?.hasGetChat,
  });
  if (decision.allowSend) {
    return { activeClient: currentClient, recovered: false };
  }

  if (!allowRecovery) {
    const error = new Error(
      decision.reason === "wwebjs-missing"
        ? "WhatsApp Web Store is not sendable; refusing to send"
        : "WhatsApp Web page is not responsive; refusing to send",
    );
    error.statusCode = 503;
    throw error;
  }

  if (connectionStatus === "READY") {
    connectionStatus = "DISCONNECTED";
    lastError = lastHealth?.error || decision.reason || "WhatsApp Store unusable";
  }

  currentClient = await performControlledRecovery(
    decision.reason === "wwebjs-missing"
      ? "pre-send-wwebjs-missing"
      : "pre-send-unresponsive",
  );
  lastHealth = await checkWhatsAppSendable(currentClient);
  const after = classifyWhatsAppSendability({
    pingOk: lastHealth.pingOk,
    hasGetChat: lastHealth.hasGetChat,
  });

  console.info("[whatsapp-web] page responsive check", {
    attempt: "post-recovery",
    sendable: lastHealth.sendable,
    pingOk: lastHealth.pingOk,
    hasGetChat: lastHealth.hasGetChat,
    action: after.action,
    durationMs: lastHealth.durationMs,
    error: lastHealth.error,
    ...collectProcessDiagnostics(currentClient),
  });

  if (!after.allowSend) {
    const error = new Error(
      after.reason === "wwebjs-missing"
        ? "WhatsApp Web Store is not sendable; refusing to send"
        : "WhatsApp Web page is not responsive; refusing to send",
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
  disconnectWhatsAppSession,
  sendTextMessage,
  getStatusPayload,
  getQrPayload,
  getDiagnosticsPayload,
};
