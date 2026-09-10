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
    source.indexOf("async function waitForReady"),
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
