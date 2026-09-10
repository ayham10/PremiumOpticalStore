const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isHarmlessPageLifecycleError,
  isDuplicatePageBindingError,
} = require("../src/lifecycle");
const {
  installWhatsAppWebJsGuards,
  wrapClientInject,
  lockClientInject,
} = require("../src/wwebjsGuard");

test("duplicate QR binding and destroyed-context errors are classified as page lifecycle", () => {
  const duplicate = new Error(
    "Failed to add page binding with name onQRChangedEvent: window['onQRChangedEvent'] already exists!",
  );
  assert.equal(isDuplicatePageBindingError(duplicate), true);
  assert.equal(isHarmlessPageLifecycleError(duplicate), true);
  assert.equal(
    isHarmlessPageLifecycleError(
      new Error("Protocol error (Runtime.callFunctionOn): Execution context was destroyed."),
    ),
    true,
  );
  assert.equal(isHarmlessPageLifecycleError(new Error("ECONNREFUSED")), false);
});

test("exposeFunctionIfAbsent does not throw on duplicate onQRChangedEvent", async () => {
  installWhatsAppWebJsGuards();
  const util = require("whatsapp-web.js/src/util/Puppeteer");
  const page = {
    async evaluate() {
      return false;
    },
    async removeExposedFunction() {},
    async exposeFunction() {
      throw new Error(
        "Failed to add page binding with name onQRChangedEvent: window['onQRChangedEvent'] already exists!",
      );
    },
  };
  await util.exposeFunctionIfAbsent(page, "onQRChangedEvent", () => {});
});

test("locked inject does not re-enter Client.inject after logout/navigation", async () => {
  function FakeClient() {
    this.injectCount = 0;
  }
  FakeClient.prototype.inject = async function originalInject() {
    this.injectCount += 1;
  };

  wrapClientInject(FakeClient);
  const instance = new FakeClient();
  await instance.inject();
  assert.equal(instance.injectCount, 1);

  lockClientInject(instance);
  await instance.inject();
  await instance.inject();
  assert.equal(instance.injectCount, 1);
});

test("stale generation cannot re-enter after logout", () => {
  const { isCurrentClientEvent } = require("../src/lifecycle");
  const retired = { id: "retired" };
  const current = { generation: 8, client: null, inFlightClient: null };
  assert.equal(
    isCurrentClientEvent({ client: retired, generation: 7 }, current),
    false,
  );
});
