const { execFileSync } = require("child_process");
const os = require("os");
const config = require("./config");

const DIAGNOSTICS_EVAL_TIMEOUT_MS = 10000;
const PRE_SEND_PING_TIMEOUT_MS = 3000;

function sanitizeError(message) {
  return String(message || "Unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .slice(0, 500);
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
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

function getPackageVersion(packageName) {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(`${packageName}/package.json`).version;
  } catch {
    return null;
  }
}

function getPuppeteerExecutablePath() {
  if (config.puppeteerExecutablePath) {
    return config.puppeteerExecutablePath;
  }

  try {
    const puppeteer = require("puppeteer");
    return puppeteer.executablePath();
  } catch {
    return null;
  }
}

function collectProcessDiagnostics() {
  const memory = process.memoryUsage();
  return {
    nodeHeapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    nodeRssMb: Math.round(memory.rss / 1024 / 1024),
    systemFreeMb: Math.round(os.freemem() / 1024 / 1024),
    systemTotalMb: Math.round(os.totalmem() / 1024 / 1024),
  };
}

function collectChromeChildProcesses(browserPid) {
  if (!browserPid) {
    return [];
  }

  try {
    const output = execFileSync(
      "ps",
      ["-o", "pid=,stat=,rss=,comm=", "--ppid", String(browserPid)],
      { encoding: "utf8", timeout: 2000 },
    );
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\S+)\s+(\d+)\s+(.+)$/);
        if (!match) {
          return { raw: line.trim() };
        }
        return {
          pid: Number(match[1]),
          stat: match[2],
          rssKb: Number(match[3]),
          command: match[4],
        };
      });
  } catch {
    return [];
  }
}

async function collectRendererDiagnostics(activeClient) {
  const browser = activeClient?.pupBrowser;
  const page = activeClient?.pupPage;
  const diagnostics = {
    browserConnected: browser?.isConnected?.() ?? null,
    browserProcessRunning: null,
    browserPid: null,
    chromeChildren: [],
    mainPageUrl: null,
    mainPageClosed: page ? page.isClosed() : null,
    targetSummary: [],
    loadedWebVersion: null,
    loadedWebVersionError: null,
    cacheMode: config.whatsappWebCacheMode,
    pinnedWebVersion: config.whatsappWebVersion,
  };

  if (!browser) {
    return diagnostics;
  }

  const browserProcess =
    typeof browser.process === "function" ? browser.process() : null;
  if (browserProcess) {
    diagnostics.browserPid = browserProcess.pid ?? null;
    diagnostics.browserProcessRunning = browserProcess.exitCode == null;
    diagnostics.chromeChildren = collectChromeChildProcesses(
      browserProcess.pid,
    );
  }

  if (page && !page.isClosed()) {
    try {
      diagnostics.mainPageUrl = page.url();
    } catch {
      diagnostics.mainPageUrl = null;
    }
  }

  if (typeof browser.targets === "function") {
    diagnostics.targetSummary = browser.targets().map((target) => ({
      type: target.type(),
      url: target.url().slice(0, 120),
    }));
  }

  if (page && !page.isClosed()) {
    try {
      diagnostics.loadedWebVersion = await withTimeout(
        page.evaluate(() => window.Debug?.VERSION || null),
        500,
        "window.Debug.VERSION",
      );
    } catch (error) {
      diagnostics.loadedWebVersionError = sanitizeError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return diagnostics;
}

async function collectBrowserSnapshot(activeClient) {
  const browser = activeClient?.pupBrowser;
  if (!browser) {
    return { pages: [], targets: [], pageCount: 0, targetCount: 0 };
  }

  const pages = await browser.pages();
  const pageSummaries = pages.map((page) => ({
    isMain: page === activeClient.pupPage,
    closed: page.isClosed(),
    url: page.isClosed() ? null : page.url(),
  }));

  const targets = typeof browser.targets === "function"
    ? browser.targets().map((target) => ({
        type: target.type(),
        url: target.url(),
      }))
    : [];

  return {
    pageCount: pageSummaries.length,
    targetCount: targets.length,
    pages: pageSummaries,
    targets,
  };
}

async function fastPagePing(activeClient, timeoutMs = PRE_SEND_PING_TIMEOUT_MS) {
  const page = activeClient?.pupPage;
  if (!page || page.isClosed()) {
    return { responsive: false, ping: null, durationMs: 0, error: "page unavailable" };
  }

  const startedAt = Date.now();
  try {
    const ping = await withTimeout(
      page.evaluate(() => 1 + 1),
      timeoutMs,
      "pre-send ping",
    );
    return {
      responsive: ping === 2,
      ping,
      durationMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      responsive: false,
      ping: null,
      durationMs: Date.now() - startedAt,
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    };
  }
}

function getChromiumVersion(executablePath) {
  if (!executablePath) {
    return null;
  }

  try {
    return execFileSync(executablePath, ["--version"], {
      encoding: "utf8",
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

function summarizeDiagnosticsForLog(diagnostics) {
  return {
    connectionStatus: diagnostics.connectionStatus,
    whatsappClientState: diagnostics.whatsappClientState,
    whatsappClientStateError: diagnostics.whatsappClientStateError,
    pageClosed: diagnostics.page?.closed,
    pageUrlHost: diagnostics.page?.urlHost,
    pageEvaluatePing: diagnostics.pageEvaluate?.ping,
    pageEvaluateDurationMs: diagnostics.pageEvaluate?.durationMs,
    pageEvaluateError: diagnostics.pageEvaluate?.error,
    windowStoreExists: diagnostics.windowStore?.exists,
    windowStoreError: diagnostics.windowStore?.error,
    browserConnected: diagnostics.chromium?.browserConnected,
    chromiumProcessRunning: diagnostics.chromium?.processRunning,
    stepTimingsMs: diagnostics.stepTimingsMs || null,
  };
}

function isPreSendResponsive(diagnostics) {
  return (
    diagnostics.pageEvaluate?.ping === 2 &&
    !diagnostics.pageEvaluate?.error &&
    diagnostics.page?.closed === false &&
    diagnostics.chromium?.browserConnected !== false
  );
}

async function collectPreSendHealthCheck(activeClient, connectionStatus) {
  const startedAt = Date.now();
  const diagnostics = {
    timestamp: new Date().toISOString(),
    connectionStatus,
    whatsappClientState: null,
    whatsappClientStateError: null,
    page: {
      exists: false,
      closed: null,
      url: null,
      urlHost: null,
    },
    pageEvaluate: {
      ping: null,
      durationMs: null,
      error: null,
    },
    windowStore: {
      exists: null,
      error: null,
    },
    chromium: {
      browserConnected: null,
      processRunning: null,
    },
    stepTimingsMs: {},
  };

  if (!activeClient) {
    diagnostics.error = "WhatsApp client is not initialized";
    diagnostics.responsive = false;
    diagnostics.totalDurationMs = Date.now() - startedAt;
    return diagnostics;
  }

  const page = activeClient.pupPage;
  const browser = activeClient.pupBrowser;
  diagnostics.page.exists = Boolean(page);

  if (browser) {
    diagnostics.chromium.browserConnected = browser.isConnected();
    const browserProcess =
      typeof browser.process === "function" ? browser.process() : null;
    if (browserProcess) {
      diagnostics.chromium.processRunning = browserProcess.exitCode == null;
    }
  }

  if (!page || page.isClosed()) {
    diagnostics.page.closed = page ? page.isClosed() : true;
    diagnostics.error = "Puppeteer page is not available";
    diagnostics.responsive = false;
    diagnostics.totalDurationMs = Date.now() - startedAt;
    return diagnostics;
  }

  diagnostics.page.closed = false;

  const urlStartedAt = Date.now();
  try {
    const url = page.url();
    diagnostics.page.url = url;
    diagnostics.page.urlHost = new URL(url).host;
  } catch (error) {
    diagnostics.page.urlError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    diagnostics.stepTimingsMs.pageUrl = Date.now() - urlStartedAt;
  }

  const pingStartedAt = Date.now();
  try {
    diagnostics.pageEvaluate.ping = await withTimeout(
      page.evaluate(() => 1 + 1),
      PRE_SEND_PING_TIMEOUT_MS,
      "page.evaluate ping",
    );
    diagnostics.pageEvaluate.durationMs = Date.now() - pingStartedAt;
  } catch (error) {
    diagnostics.pageEvaluate.error = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    diagnostics.pageEvaluate.durationMs = Date.now() - pingStartedAt;
  } finally {
    diagnostics.stepTimingsMs.pageEvaluatePing = Date.now() - pingStartedAt;
  }

  if (diagnostics.pageEvaluate.ping !== 2 || diagnostics.pageEvaluate.error) {
    diagnostics.responsive = false;
    diagnostics.totalDurationMs = Date.now() - startedAt;
    return diagnostics;
  }

  const storeStartedAt = Date.now();
  try {
    diagnostics.windowStore.exists = await withTimeout(
      page.evaluate(
        () => typeof window.Store !== "undefined" && window.Store !== null,
      ),
      PRE_SEND_PING_TIMEOUT_MS,
      "window.Store check",
    );
  } catch (error) {
    diagnostics.windowStore.error = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    diagnostics.stepTimingsMs.windowStore = Date.now() - storeStartedAt;
  }

  const stateStartedAt = Date.now();
  try {
    diagnostics.whatsappClientState = await withTimeout(
      activeClient.getState(),
      PRE_SEND_PING_TIMEOUT_MS,
      "client.getState()",
    );
  } catch (error) {
    diagnostics.whatsappClientStateError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    diagnostics.stepTimingsMs.clientGetState = Date.now() - stateStartedAt;
  }

  diagnostics.responsive = isPreSendResponsive(diagnostics);

  return diagnostics;
}

async function collectWhatsAppDiagnostics(activeClient, connectionStatus) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    connectionStatus,
    whatsappClientState: null,
    whatsappClientStateError: null,
    page: {
      exists: false,
      closed: null,
      url: null,
      urlHost: null,
      title: null,
      titleError: null,
    },
    pageEvaluate: {
      ping: null,
      durationMs: null,
      error: null,
    },
    windowStore: {
      exists: null,
      error: null,
    },
    chromium: {
      browserConnected: null,
      processRunning: null,
      pid: null,
      version: getChromiumVersion(getPuppeteerExecutablePath()),
    },
    runtime: {
      headlessMode: config.puppeteerHeadlessMode,
      protocolTimeoutMs: config.protocolTimeoutMs,
      sendMessageTimeoutMs: config.sendMessageTimeoutMs,
      browserSource: config.puppeteerExecutablePath
        ? "PUPPETEER_EXECUTABLE_PATH"
        : "puppeteer-cache",
      puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || null,
    },
    compatibility: {
      whatsappWebJs: getPackageVersion("whatsapp-web.js"),
      puppeteer: getPackageVersion("puppeteer"),
      expectedChromeForTesting: "146.0.7680.31",
      webCacheMode: config.whatsappWebCacheMode,
      pinnedWhatsAppWebVersion: config.whatsappWebVersion,
      note:
        "Default webCacheMode=live loads current HTML from web.whatsapp.com. Set WHATSAPP_WEB_CACHE_MODE=pinned only for A/B comparison.",
    },
  };

  if (!activeClient) {
    diagnostics.error = "WhatsApp client is not initialized";
    return diagnostics;
  }

  const page = activeClient.pupPage;
  const browser = activeClient.pupBrowser;

  diagnostics.page.exists = Boolean(page);

  if (browser) {
    diagnostics.chromium.browserConnected = browser.isConnected();
    const browserProcess = typeof browser.process === "function" ? browser.process() : null;
    if (browserProcess) {
      diagnostics.chromium.pid = browserProcess.pid ?? null;
      diagnostics.chromium.processRunning = browserProcess.exitCode == null;
    }
  }

  if (!page) {
    diagnostics.error = "Puppeteer page is not available";
    return diagnostics;
  }

  diagnostics.page.closed = page.isClosed();

  if (page.isClosed()) {
    diagnostics.error = "Puppeteer page is closed";
    return diagnostics;
  }

  try {
    const url = page.url();
    diagnostics.page.url = url;
    diagnostics.page.urlHost = new URL(url).host;
  } catch (error) {
    diagnostics.page.url = null;
    diagnostics.page.urlHost = null;
    diagnostics.page.urlError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    diagnostics.page.title = await withTimeout(
      page.title(),
      DIAGNOSTICS_EVAL_TIMEOUT_MS,
      "page.title()",
    );
  } catch (error) {
    diagnostics.page.titleError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  }

  const pingStartedAt = Date.now();
  try {
    diagnostics.pageEvaluate.ping = await withTimeout(
      page.evaluate(() => 1 + 1),
      DIAGNOSTICS_EVAL_TIMEOUT_MS,
      "page.evaluate ping",
    );
    diagnostics.pageEvaluate.durationMs = Date.now() - pingStartedAt;
  } catch (error) {
    diagnostics.pageEvaluate.error = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
    diagnostics.pageEvaluate.durationMs = Date.now() - pingStartedAt;
  }

  try {
    diagnostics.windowStore.exists = await withTimeout(
      page.evaluate(
        () => typeof window.Store !== "undefined" && window.Store !== null,
      ),
      DIAGNOSTICS_EVAL_TIMEOUT_MS,
      "window.Store check",
    );
  } catch (error) {
    diagnostics.windowStore.error = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    diagnostics.whatsappClientState = await withTimeout(
      activeClient.getState(),
      DIAGNOSTICS_EVAL_TIMEOUT_MS,
      "client.getState()",
    );
  } catch (error) {
    diagnostics.whatsappClientStateError = sanitizeError(
      error instanceof Error ? error.message : String(error),
    );
  }

  diagnostics.responsive = isPreSendResponsive(diagnostics);
  diagnostics.renderer = await collectRendererDiagnostics(activeClient);

  return diagnostics;
}

module.exports = {
  DIAGNOSTICS_EVAL_TIMEOUT_MS,
  PRE_SEND_PING_TIMEOUT_MS,
  collectWhatsAppDiagnostics,
  collectPreSendHealthCheck,
  collectBrowserSnapshot,
  collectProcessDiagnostics,
  collectRendererDiagnostics,
  fastPagePing,
  isPreSendResponsive,
  summarizeDiagnosticsForLog,
};
