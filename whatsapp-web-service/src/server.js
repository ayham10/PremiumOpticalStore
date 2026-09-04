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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

app.get("/qr-view", (_req, res) => {
  const qr = getQrPayload();
  const status = getStatusPayload();

  const body = qr.qrDataUrl
    ? `<img src="${escapeHtml(qr.qrDataUrl)}" alt="WhatsApp QR code" width="320" height="320" />`
    : `<p>No QR code is currently available.</p>
       <p><strong>Status:</strong> ${escapeHtml(status.status)}</p>
       ${status.lastError ? `<p><strong>Last error:</strong> ${escapeHtml(status.lastError)}</p>` : ""}`;

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OYON WhatsApp QR</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #070a0d; color: #f5f5f5; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { text-align: center; max-width: 420px; }
    h1 { color: #d4af6a; font-size: 1.1rem; font-weight: 600; letter-spacing: 0.04em; }
    p { color: #b8bec6; line-height: 1.5; }
    img { border: 1px solid rgba(212, 175, 106, 0.35); border-radius: 12px; background: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>WhatsApp Web QR</h1>
    ${body}
  </main>
</body>
</html>`);
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
