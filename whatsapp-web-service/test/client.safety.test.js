const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("automatic recovery never clears LocalAuth", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );

  assert.match(source, /async function performControlledRecovery/);
  assert.match(
    source,
    /await stopCurrentClient\(\{\s*clearSession:\s*false\s*\}\)/,
  );

  const recoveryFn = source.slice(
    source.indexOf("async function performControlledRecovery"),
    source.indexOf("async function ensurePageResponsiveForSend"),
  );
  assert.doesNotMatch(recoveryFn, /clearSession:\s*true/);
  assert.doesNotMatch(recoveryFn, /removeOwnedLocalAuthSession/);
  assert.doesNotMatch(recoveryFn, /unlinkWhatsAppClient/);
  assert.match(source, /pre-send-wwebjs-missing/);
  assert.match(source, /keepalive-wwebjs-missing/);
  assert.match(source, /navigation-store-invalid/);
});

test("explicit reset and disconnect remain the only session-clear paths", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );

  const resetFn = source.slice(
    source.indexOf("async function resetWhatsAppSession"),
    source.indexOf("async function unlinkWhatsAppClient"),
  );
  const disconnectFn = source.slice(
    source.indexOf("async function disconnectWhatsAppSession"),
    source.indexOf("async function waitForReady(activeClient"),
  );

  assert.match(resetFn, /clearSession:\s*true/);
  assert.match(disconnectFn, /clearSession:\s*true/);
  assert.match(source, /WWEBJS_AUTH_DATA_PATH|authDataPath/);
  assert.match(source, /\.\/data\/wwebjs-auth|config\.authDataPath/);
});

test("default auth data path is unchanged", () => {
  const config = require("../src/config");
  assert.equal(config.authDataPath, "./data/wwebjs-auth");
});

function functionSource(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  assert.notEqual(end, -1, `missing ${endNeedle}`);
  assert.ok(end > start, `${endNeedle} must follow ${startNeedle}`);
  return source.slice(start, end);
}

test("reconnect never clears LocalAuth", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );
  const reconnectFn = functionSource(
    source,
    "async function reconnectWhatsAppClient",
    "async function resetWhatsAppSession",
  );

  assert.match(reconnectFn, /lifecycleMutex\.runExclusive/);
  assert.match(reconnectFn, /stopCurrentClient\(\{\s*clearSession:\s*false\s*\}\)/);
  assert.match(reconnectFn, /startFreshClientUnlocked\(\)/);
  assert.match(reconnectFn, /waitForReadyOrQrRequired/);
  assert.doesNotMatch(reconnectFn, /clearSession:\s*true/);
  assert.doesNotMatch(reconnectFn, /removeOwnedLocalAuthSession/);
  assert.doesNotMatch(reconnectFn, /unlinkWhatsAppClient/);
  assert.doesNotMatch(reconnectFn, /data\/wwebjs-auth/);
});

test("reset and disconnect still clear LocalAuth", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );
  const resetFn = functionSource(
    source,
    "async function resetWhatsAppSession",
    "async function unlinkWhatsAppClient",
  );
  const disconnectFn = functionSource(
    source,
    "async function disconnectWhatsAppSession",
    "async function waitForReady(activeClient",
  );

  assert.match(resetFn, /stopCurrentClient\(\{\s*clearSession:\s*true\s*\}\)/);
  assert.match(disconnectFn, /stopCurrentClient\(\{\s*clearSession:\s*true\s*\}\)/);
});

test("reconnect does not overlap client generations", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );
  const reconnectFn = functionSource(
    source,
    "async function reconnectWhatsAppClient",
    "async function resetWhatsAppSession",
  );
  assert.match(
    reconnectFn,
    /lifecycleMutex\.runExclusive\(async \(\) => \{\s*await stopCurrentClient\(\{\s*clearSession:\s*false\s*\}\);\s*await startFreshClientUnlocked\(\);\s*\}\)/,
  );
  assert.equal(
    (reconnectFn.match(/startFreshClientUnlocked/g) || []).length,
    1,
  );
  assert.equal((reconnectFn.match(/lifecycleMutex\.runExclusive/g) || []).length, 1);
  assert.match(reconnectFn, /adminMutationBusy\s*=\s*true/);
  assert.doesNotMatch(
    reconnectFn.slice(0, reconnectFn.indexOf("lifecycleMutex.runExclusive")),
    /startFreshClientUnlocked/,
  );
});

test("reconnect preserves READY and QR_REQUIRED state transitions", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "src", "client.js"),
    "utf8",
  );
  const waitFn = functionSource(
    source,
    "async function waitForReadyOrQrRequired",
    "async function cleanupStaleChromiumLocksOnce",
  );
  const reconnectFn = functionSource(
    source,
    "async function reconnectWhatsAppClient",
    "async function resetWhatsAppSession",
  );

  assert.match(waitFn, /connectionStatus === "READY"/);
  assert.match(waitFn, /connectionStatus === "QR_REQUIRED"/);
  assert.match(reconnectFn, /waitForReadyOrQrRequired\(45000/);
  assert.match(reconnectFn, /if \(connectionStatus === "READY"\)/);
});

test("admin UI maps reconnect and reset to the correct APIs", () => {
  const ui = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "components",
      "admin",
      "BookingMessagesSettingsSection.tsx",
    ),
    "utf8",
  );

  assert.match(ui, /action === "reconnect"/);
  assert.match(ui, /setConfirmAction\("reconnect"\)/);
  assert.match(ui, /setConfirmAction\("reset"\)/);
  assert.match(
    ui,
    /\/api\/settings\/whatsapp-web\/reconnect/,
  );
  assert.match(
    ui,
    /\/api\/settings\/whatsapp-web\/reset-session/,
  );
  assert.match(
    ui,
    /\/api\/settings\/whatsapp-web\/disconnect/,
  );

  const reconnectStart = ui.indexOf('if (action === "reconnect")');
  const resetStart = ui.indexOf('if (action === "reset")');
  const reconnectBranch = ui.slice(reconnectStart, resetStart);
  assert.match(reconnectBranch, /\/api\/settings\/whatsapp-web\/reconnect/);
  assert.doesNotMatch(reconnectBranch, /reset-session/);

  const resetBranch = ui.slice(
    resetStart,
    ui.indexOf("applyStatus({", resetStart),
  );
  assert.match(resetBranch, /\/api\/settings\/whatsapp-web\/reset-session/);
  assert.doesNotMatch(resetBranch, /\/reconnect/);
});
