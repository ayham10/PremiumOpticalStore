const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const { toWhatsAppChatId } = require("./phone");

/** @type {"INITIALIZING"|"QR_REQUIRED"|"AUTHENTICATED"|"READY"|"DISCONNECTED"|"AUTH_FAILURE"} */
let connectionStatus = "INITIALIZING";
let latestQrRaw = null;
let latestQrDataUrl = null;
let lastError = null;
let client = null;
let initializing = false;

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

function buildPuppeteerConfig() {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
  ];

  const puppeteer = {
    headless: true,
    args,
  };

  if (config.puppeteerExecutablePath) {
    puppeteer.executablePath = config.puppeteerExecutablePath;
  }

  return puppeteer;
}

function attachClientEvents(activeClient) {
  activeClient.on("qr", async (qr) => {
    connectionStatus = "QR_REQUIRED";
    lastError = null;
    await setQr(qr);
    console.info("[whatsapp-web] QR code updated — scan to authenticate");
  });

  activeClient.on("authenticated", () => {
    connectionStatus = "AUTHENTICATED";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] authenticated");
  });

  activeClient.on("ready", () => {
    connectionStatus = "READY";
    lastError = null;
    clearQr();
    console.info("[whatsapp-web] client ready");
  });

  activeClient.on("disconnected", (reason) => {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(reason || "disconnected");
    clearQr();
    console.warn("[whatsapp-web] disconnected", { reason: lastError });
  });

  activeClient.on("auth_failure", (message) => {
    connectionStatus = "AUTH_FAILURE";
    lastError = sanitizeError(message || "auth_failure");
    clearQr();
    console.error("[whatsapp-web] authentication failed", {
      error: lastError,
    });
  });
}

async function initializeWhatsAppClient() {
  if (client || initializing) {
    return client;
  }

  initializing = true;
  connectionStatus = "INITIALIZING";
  lastError = null;

  try {
    ensureAuthDirectory();

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.resolve(config.authDataPath),
      }),
      puppeteer: buildPuppeteerConfig(),
    });

    attachClientEvents(client);

    client.initialize().catch((error) => {
      connectionStatus = "DISCONNECTED";
      lastError = sanitizeError(error instanceof Error ? error.message : error);
      console.error("[whatsapp-web] initialize failed", { error: lastError });
    });
  } catch (error) {
    connectionStatus = "DISCONNECTED";
    lastError = sanitizeError(error instanceof Error ? error.message : error);
    console.error("[whatsapp-web] client setup failed", { error: lastError });
  } finally {
    initializing = false;
  }

  return client;
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

  const result = await activeClient.sendMessage(chatId, text);
  return {
    chatId,
    messageId: result?.id?._serialized || result?.id || null,
  };
}

module.exports = {
  initializeWhatsAppClient,
  sendTextMessage,
  getStatusPayload,
  getQrPayload,
};
