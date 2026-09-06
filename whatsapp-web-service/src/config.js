require("dotenv").config();

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
};
