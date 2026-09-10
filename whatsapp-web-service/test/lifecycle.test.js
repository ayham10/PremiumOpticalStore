const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isRetryableInitError,
  isGenuineWhatsAppLogout,
  isBrowserDisconnectReason,
  isCurrentClientEvent,
  createMutex,
  createRecoveryBudget,
} = require("../src/lifecycle");

test("retryable init errors include overlapping Chromium and detached frame", () => {
  assert.equal(
    isRetryableInitError(new Error("Execution context was destroyed")),
    true,
  );
  assert.equal(isRetryableInitError(new Error("Attempted to use detached Frame")), true);
  assert.equal(
    isRetryableInitError(
      new Error("The browser is already running for /data/wwebjs-auth/session"),
    ),
    true,
  );
  assert.equal(
    isRetryableInitError(
      new Error(
        "Failed to add page binding with name onQRChangedEvent: window['onQRChangedEvent'] already exists!",
      ),
    ),
    true,
  );
  assert.equal(isRetryableInitError(new Error("Runtime.callFunctionOn timed out")), true);
  assert.equal(isRetryableInitError(new Error("Target closed")), true);
  assert.equal(isRetryableInitError(new Error("ECONNREFUSED")), false);
});

test("genuine WhatsApp logout is distinct from browser disconnect", () => {
  assert.equal(isGenuineWhatsAppLogout("LOGOUT"), true);
  assert.equal(isGenuineWhatsAppLogout("UNPAIRED"), true);
  assert.equal(isGenuineWhatsAppLogout("NAVIGATION"), false);
  assert.equal(isGenuineWhatsAppLogout("TIMEOUT"), false);
  assert.equal(isBrowserDisconnectReason("NAVIGATION"), true);
  assert.equal(isBrowserDisconnectReason("CONFLICT"), true);
  assert.equal(isBrowserDisconnectReason("LOGOUT"), false);
});

test("stale client events are ignored across generations", () => {
  const oldClient = { id: "old" };
  const newClient = { id: "new" };
  const current = { generation: 4, client: newClient, inFlightClient: null };

  assert.equal(
    isCurrentClientEvent({ client: oldClient, generation: 3 }, current),
    false,
  );
  assert.equal(
    isCurrentClientEvent({ client: newClient, generation: 4 }, current),
    true,
  );
  assert.equal(
    isCurrentClientEvent({ client: oldClient, generation: 4 }, current),
    false,
  );
});

test("mutex never runs two exclusive tasks at the same time", async () => {
  const mutex = createMutex();
  let concurrent = 0;
  let maxConcurrent = 0;

  async function task() {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((resolve) => setTimeout(resolve, 25));
    concurrent -= 1;
  }

  await Promise.all([
    mutex.runExclusive(task),
    mutex.runExclusive(task),
    mutex.runExclusive(task),
  ]);

  assert.equal(maxConcurrent, 1);
  assert.equal(mutex.locked, false);
});

test("recovery budget is bounded inside the window", () => {
  const budget = createRecoveryBudget({ maxAttempts: 3, windowMs: 10_000 });
  const t0 = 1_000_000;
  assert.equal(budget.canAttempt(t0), true);
  budget.record(t0);
  budget.record(t0 + 1);
  budget.record(t0 + 2);
  assert.equal(budget.canAttempt(t0 + 3), false);
  assert.equal(budget.remaining(t0 + 3), 0);
  assert.equal(budget.canAttempt(t0 + 10_001), true);
});
