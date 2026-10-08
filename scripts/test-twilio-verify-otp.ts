import assert from "node:assert/strict";
import { normalizeIsraeliPhone } from "../lib/eye-exam";
import {
  consumeTwilioVerifyOtpCheckQuota,
  consumeTwilioVerifyOtpSendQuota,
  getTwilioVerifyOtpStatus,
  getTwilioVerifyServiceSid,
  isTwilioVerifyOtpTestAllowed,
  listMissingTwilioVerifyOtpVars,
  resetTwilioVerifyOtpRateLimitsForTests,
  sanitizeTwilioVerifyError,
} from "../lib/twilio/verify-otp";

assert.equal(normalizeIsraeliPhone("0522427299"), "+972522427299");
assert.equal(normalizeIsraeliPhone("+972522427299"), "+972522427299");
assert.equal(normalizeIsraeliPhone("972522427299"), "+972522427299");
assert.equal(normalizeIsraeliPhone("522427299"), "+972522427299");
assert.equal(normalizeIsraeliPhone("123"), null);

assert.equal(isTwilioVerifyOtpTestAllowed(undefined), true);
assert.equal(isTwilioVerifyOtpTestAllowed("development"), true);
assert.equal(isTwilioVerifyOtpTestAllowed("preview"), false);
assert.equal(isTwilioVerifyOtpTestAllowed("production"), false);
assert.equal(isTwilioVerifyOtpTestAllowed("preview", "1"), true);
assert.equal(isTwilioVerifyOtpTestAllowed("production", "1"), false);

assert.deepEqual(
  listMissingTwilioVerifyOtpVars({}),
  ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
);
assert.deepEqual(
  listMissingTwilioVerifyOtpVars({
    TWILIO_ACCOUNT_SID: "AC123",
    TWILIO_AUTH_TOKEN: "secret",
  }),
  [],
);

const prodStatus = getTwilioVerifyOtpStatus("production", undefined, {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret",
});
assert.equal(prodStatus.enabled, false);
assert.equal(prodStatus.configured, false);

assert.equal(
  getTwilioVerifyServiceSid({}),
  "VAae12300bae697eafe242c14a05f98d37",
);
assert.equal(
  getTwilioVerifyServiceSid({ TWILIO_VERIFY_SERVICE_SID: " VAcustom " }),
  "VAcustom",
);

resetTwilioVerifyOtpRateLimitsForTests();
assert.equal(consumeTwilioVerifyOtpSendQuota("+972521111111", "1.1.1.1"), true);
assert.equal(consumeTwilioVerifyOtpSendQuota("+972521111111", "1.1.1.1"), true);
assert.equal(consumeTwilioVerifyOtpSendQuota("+972521111111", "1.1.1.1"), true);
assert.equal(consumeTwilioVerifyOtpSendQuota("+972521111111", "1.1.1.1"), false);

resetTwilioVerifyOtpRateLimitsForTests();
for (let i = 0; i < 8; i += 1) {
  assert.equal(consumeTwilioVerifyOtpCheckQuota("+972522222222"), true);
}
assert.equal(consumeTwilioVerifyOtpCheckQuota("+972522222222"), false);

const redacted = sanitizeTwilioVerifyError(
  `Basic abcdef== ${"AC"}${"0".repeat(32)} token=supersecret`,
);
assert.equal(redacted.includes("supersecret"), false);
assert.equal(redacted.includes("Basic abcdef"), false);
assert.match(redacted, /AC\[redacted\]/);

console.log("twilio-verify-otp tests passed");
