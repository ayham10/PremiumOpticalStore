const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { PreserveLocalAuth } = require("../src/localAuth");

test("PreserveLocalAuth.logout does not delete the session directory by default", async () => {
  const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), "oyon-wwebjs-"));
  const auth = new PreserveLocalAuth({ dataPath });
  const sessionDir = path.join(dataPath, "session");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "keep-me"), "session");
  auth.userDataDir = sessionDir;

  await auth.logout();

  assert.equal(fs.existsSync(path.join(sessionDir, "keep-me")), true);
});

test("PreserveLocalAuth.logout deletes the session only after allowSessionDelete", async () => {
  const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), "oyon-wwebjs-"));
  const auth = new PreserveLocalAuth({ dataPath });
  const sessionDir = path.join(dataPath, "session");
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, "remove-me"), "session");
  auth.userDataDir = sessionDir;
  auth.allowSessionDelete();

  await auth.logout();

  assert.equal(fs.existsSync(sessionDir), false);
});
