const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  classifyWhatsAppSendability,
  isLogoutNavigationUrl,
  isGenuineWhatsAppLogout,
} = require("../src/lifecycle");
const {
  checkWhatsAppSendable,
  isPreSendResponsive,
} = require("../src/diagnostics");

test("browser ping healthy + WWebJS/getChat missing must NOT attempt send", () => {
  const decision = classifyWhatsAppSendability({
    pingOk: true,
    hasGetChat: false,
  });
  assert.equal(decision.allowSend, false);
  assert.equal(decision.action, "fresh-client-recovery");
  assert.equal(decision.reason, "wwebjs-missing");
});

test("missing WWebJS triggers controlled fresh-generation recovery", () => {
  const decision = classifyWhatsAppSendability({
    pingOk: true,
    hasGetChat: false,
    logout: false,
  });
  assert.equal(decision.action, "fresh-client-recovery");
  assert.notEqual(decision.action, "qr-required");
  assert.notEqual(decision.action, "send");
});

test("non-logout navigation invalidates READY and recovers with a fresh Client", () => {
  assert.equal(isLogoutNavigationUrl("https://web.whatsapp.com/"), false);
  const decision = classifyWhatsAppSendability({
    pingOk: true,
    hasGetChat: false,
  });
  assert.equal(decision.action, "fresh-client-recovery");

  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );
  const navFn = source.slice(
    source.indexOf("async function onOwnedFrameNavigated"),
    source.indexOf("function isMainFrameNavigation"),
  );
  assert.match(navFn, /performControlledRecovery\("navigation-store-invalid"\)/);
  assert.doesNotMatch(navFn, /\.inject\(/);
  assert.match(source, /lockClientInject/);
});

test("genuine LOGOUT still goes to QR_REQUIRED", () => {
  assert.equal(isGenuineWhatsAppLogout("LOGOUT"), true);
  assert.equal(
    isLogoutNavigationUrl("https://web.whatsapp.com/?post_logout=1"),
    true,
  );
  const decision = classifyWhatsAppSendability({
    pingOk: true,
    hasGetChat: false,
    logout: true,
  });
  assert.equal(decision.action, "qr-required");
  assert.equal(decision.allowSend, false);
});

test("pre-send ping without getChat is not sendable", () => {
  assert.equal(
    isPreSendResponsive({
      pageEvaluate: { ping: 2, error: null },
      page: { closed: false },
      chromium: { browserConnected: true },
      wwebjs: { hasGetChat: false },
    }),
    false,
  );
  assert.equal(
    isPreSendResponsive({
      pageEvaluate: { ping: 2, error: null },
      page: { closed: false },
      chromium: { browserConnected: true },
      wwebjs: { hasGetChat: true },
    }),
    true,
  );
});

test("checkWhatsAppSendable refuses send when ping works but getChat is missing", async () => {
  const fakeClient = {
    pupPage: {
      isClosed: () => false,
      evaluate: async (fn) => {
        const src = Function.prototype.toString.call(fn);
        if (src.includes("1 + 1")) {
          return 2;
        }
        return false;
      },
    },
  };
  const health = await checkWhatsAppSendable(fakeClient, 1000);
  const decision = classifyWhatsAppSendability({
    pingOk: health.pingOk,
    hasGetChat: health.hasGetChat,
  });
  assert.equal(health.pingOk, true);
  assert.equal(health.hasGetChat, false);
  assert.equal(health.sendable, false);
  assert.equal(decision.allowSend, false);
  assert.equal(decision.action, "fresh-client-recovery");
});
