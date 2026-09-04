const express = require("express");
const config = require("./config");
const {
  initializeWhatsAppClient,
  sendTextMessage,
  getStatusPayload,
  getQrPayload,
} = require("./client");

const app = express();
app.use(express.json({ limit: "32kb" }));

function sanitizeLogBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    to: body.to ? "[redacted-phone]" : undefined,
    messageLength:
      typeof body.message === "string" ? body.message.length : undefined,
  };
}

function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    console.error("[whatsapp-web] WHATSAPP_WEB_SERVICE_API_KEY is not configured");
    return res.status(503).json({
      ok: false,
      error: "Send endpoint is not configured with an API key",
    });
  }

  const header = req.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const apiKeyHeader = req.get("x-api-key") || "";
  const provided = bearer || apiKeyHeader;

  if (!provided || provided !== config.apiKey) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return next();
}

app.get("/health", (_req, res) => {
  const status = getStatusPayload();
  res.json({
    ok: true,
    service: "oyon-whatsapp-web-service",
    timestamp: new Date().toISOString(),
    whatsapp: status,
  });
});

app.get("/status", (_req, res) => {
  res.json(getStatusPayload());
});

app.get("/qr", (_req, res) => {
  res.json(getQrPayload());
});

app.post("/send", requireApiKey, async (req, res) => {
  try {
    const { to, message } = req.body || {};
    console.info("[whatsapp-web] send request", sanitizeLogBody(req.body));

    const result = await sendTextMessage(to, message);
    res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const detail = error instanceof Error ? error.message : "Send failed";
    console.error("[whatsapp-web] send failed", {
      statusCode,
      error: detail.slice(0, 500),
    });
    res.status(statusCode).json({
      ok: false,
      error: detail,
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

app.listen(config.port, () => {
  console.info("[whatsapp-web] service listening", {
    port: config.port,
    authDataPath: config.authDataPath,
  });
  void initializeWhatsAppClient();
});
