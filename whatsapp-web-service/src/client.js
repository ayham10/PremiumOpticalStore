const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const { toWhatsAppChatId } = require("./phone");
const { removeStaleChromiumProfileLocks } = require("./profileLocks");
const {
  collectWhatsAppDiagnostics,
  summarizeDiagnosticsForLog,
} = require("./diagnostics");

/** @type {"INITIALIZING"|"QR_REQUIRED"|"AUTHENTICATED"|"READY"|"DISCONNECTED"|"AUTH_FAILURE"} */
let connectionStatus = "INITIALIZING";
let latestQrRaw = null;
let latestQrDataUrl = null;
let lastError = null;
let client = null;
/** @type {Promise<import("whatsapp-web.js").Client | null> | null} */
let initPromise = null;
let staleChromiumLocksCleanedUp = false;

const MAX_INIT_ATTEMPTS = 3;
const INIT_RETRY_DELAY_MS = 4000;

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

/** Essential container flags for Puppeteer Chrome for Testing. */
const PUPPETEER_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
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
    generatedAt: latestQrRaw ? new Date().toISOString() : null,
  };
}

function sanitizeError(message) {
  return String(message || "Unknown error")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/api[_-]?key[=:]\S+/gi, "api_key=[redacted]")
    .slice(0, 500);
}

async function setQr(rawQr) {
  latestQrRaw = rawQr;
  try {
    latestQrDataUrl = await qrcode.toDataURL(rawQr, {
      margin: 1,
      width: 320,
    });
  } catch (error) {
    latestQrDataUrl = null;
    console.error("[whatsapp-web] failed to render QR data URL", {
      error: sanitizeError(error instanceof Error ? error.message : error),
    });
  }
}

function clearQr() {
  latestQrRaw = null;
  latestQrDataUrl = null;
}

function ensureAuthDirectory() {
  fs.mkdirSync(path.resolve(config.authDataPath), { recursive: true });
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

function attachClientEvents(activeClient) {
  activeClient.on("qr", async (qr) => {
    connectionStatus = "QR_REQUIRED";
    lastError = null;
    await setQr(qr);
    console.info("[whatsapp-web] QR_RECEIVED");
  });

  activeClient.on("authenticated", () => {
    connectionStatus = "AUTHENTICATED";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] AUTHENTICATED");
  });

  activeClient.on("ready", () => {
    connectionStatus = "READY";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] READY");
  });

  activeClient.on("disconnected", (reason) => {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(reason || "disconnected");
    clearQr();
    console.warn("[whatsapp-web] DISCONNECTED", { reason: lastError });
  });

  activeClient.on("auth_failure", (message) => {
    connectionStatus = "AUTH_FAILURE";
    lastError = sanitizeError(message || "auth_failure");
    clearQr();
    console.error("[whatsapp-web] AUTH_FAILURE", {
      error: lastError,
    });
  });
}

async function destroyFailedClient(activeClient) {
  if (!activeClient) {
    return;
  }

  try {
    if (typeof activeClient.destroy === "function") {
      await activeClient.destroy();
    }
  } catch (error) {
    console.warn("[whatsapp-web] failed to destroy client during init cleanup", {
      error: sanitizeError(error instanceof Error ? error.message : String(error)),
    });
  }
}

async function initializeWhatsAppClient() {
  if (client) {
    return client;
  }

  if (!initPromise) {
    initPromise = createWhatsAppClient();
  }

  return initPromise;
}

async function createWhatsAppClient() {
  connectionStatus = "INITIALIZING";
  lastError = null;

  ensureAuthDirectory();
  await cleanupStaleChromiumLocksOnce();

  const browserInfo = getResolvedBrowserInfo();
  console.info("[whatsapp-web] launching browser", {
    source: browserInfo.source,
    headlessMode: config.puppeteerHeadlessMode,
    cacheDir: process.env.PUPPETEER_CACHE_DIR || null,
  });

  let lastInitError = null;

  for (let attempt = 1; attempt <= MAX_INIT_ATTEMPTS; attempt += 1) {
    connectionStatus = "INITIALIZING";
    console.info("[whatsapp-web] initialization attempt", {
      attempt,
      maxAttempts: MAX_INIT_ATTEMPTS,
    });

    if (client) {
      await destroyFailedClient(client);
      client = null;
    }

    try {
      client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.resolve(config.authDataPath),
        }),
        puppeteer: buildPuppeteerConfig(),
      });

      attachClientEvents(client);
      await client.initialize();

      console.info("[whatsapp-web] initialization succeeded", { attempt });
      return client;
    } catch (error) {
      lastInitError = error;
      const detail = sanitizeError(
        error instanceof Error ? error.message : String(error),
      );
      console.error("[whatsapp-web] initialization failed", {
        attempt,
        error: detail,
      });

      await destroyFailedClient(client);
      client = null;

      const shouldRetry =
        attempt < MAX_INIT_ATTEMPTS && isRetryableInitError(error);
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

  connectionStatus = "DISCONNECTED";
  lastError = sanitizeError(
    lastInitError instanceof Error ? lastInitError.message : String(lastInitError),
  );
  console.error("[whatsapp-web] initialization exhausted retries", {
    attempts: MAX_INIT_ATTEMPTS,
    error: lastError,
  });

  return client;
}

async function getDiagnosticsPayload() {
  const activeClient = await initializeWhatsAppClient();
  return collectWhatsAppDiagnostics(activeClient, connectionStatus);
}

async function runPreSendDiagnostics(activeClient) {
  const diagnostics = await collectWhatsAppDiagnostics(
    activeClient,
    connectionStatus,
  );

  console.info("[whatsapp-web] pre-send diagnostics", {
    ...summarizeDiagnosticsForLog(diagnostics),
    headlessMode: config.puppeteerHeadlessMode,
  });

  if (!diagnostics.responsive) {
    const error = new Error(
      "WhatsApp Web page is not responsive; refusing to send",
    );
    error.statusCode = 503;
    error.diagnostics = summarizeDiagnosticsForLog(diagnostics);
    throw error;
  }

  return diagnostics;
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
  console.info("[whatsapp-web] send started", {
    messageLength: text.length,
    timeoutMs: config.sendMessageTimeoutMs,
  });

  try {
    await runPreSendDiagnostics(activeClient);

    const result = await withTimeout(
      activeClient.sendMessage(chatId, text),
      config.sendMessageTimeoutMs,
      "WhatsApp Web did not respond in time",
      504,
    );

    console.info("[whatsapp-web] send succeeded", {
      durationMs: Date.now() - startedAt,
      messageLength: text.length,
    });

    return {
      chatId,
      messageId: result?.id?._serialized || result?.id || null,
    };
  } catch (error) {
    const normalizedError = normalizeSendError(error);
    console.error("[whatsapp-web] send failed", {
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
  sendTextMessage,
  getStatusPayload,
  getQrPayload,
  getDiagnosticsPayload,
};
