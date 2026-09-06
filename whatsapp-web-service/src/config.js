require("dotenv").config();
const path = require("path");

function env(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

module.exports = {
  port: Number(env("PORT", "3100")) || 3100,
  apiKey: env("WHATSAPP_WEB_SERVICE_API_KEY"),
  authDataPath: env("WWEBJS_AUTH_DATA_PATH", "./data/wwebjs-auth"),
  puppeteerExecutablePath: env("PUPPETEER_EXECUTABLE_PATH"),
  puppeteerHeadlessMode: env("PUPPETEER_HEADLESS", "true") === "shell" ? "shell" : true,
  protocolTimeoutMs:
    Number(env("PUPPETEER_PROTOCOL_TIMEOUT_MS", "120000")) || 120000,
  sendMessageTimeoutMs:
    Number(env("WHATSAPP_SEND_TIMEOUT_MS", "90000")) || 90000,
  // live = fetch current HTML from web.whatsapp.com (default, avoids pinned-cache freeze)
  // pinned = strict local HTML cache via request interception (diagnostic override only)
  whatsappWebCacheMode: env("WHATSAPP_WEB_CACHE_MODE", "live"),
  whatsappWebVersion: env(
    "WHATSAPP_WEB_VERSION",
    "2.3000.1046816453-alpha",
  ),
  whatsappWebCachePath: env(
    "WHATSAPP_WEB_CACHE_PATH",
    path.join(__dirname, "..", ".wwebjs_cache"),
  ),
};
