import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OYON_GA_MEASUREMENT_ID,
  getGoogleAnalyticsId,
  isValidGaMeasurementId,
} from "../lib/google-analytics";

assert.equal(OYON_GA_MEASUREMENT_ID, "G-KMS1H8EZLQ");
assert.ok(isValidGaMeasurementId("G-KMS1H8EZLQ"));
assert.ok(!isValidGaMeasurementId("UA-123"));
assert.ok(!isValidGaMeasurementId(""));

const layout = readFileSync("app/layout.tsx", "utf8");
assert.match(layout, /<PublicGoogleAnalytics \/>/);
assert.equal((layout.match(/gtag\/js/g) ?? []).length, 0);

const analytics = readFileSync("components/analytics/PublicGoogleAnalytics.tsx", "utf8");
assert.match(analytics, /oyon-google-analytics/);
assert.match(analytics, /send_page_view: false/);
assert.match(analytics, /!pathname\.startsWith\("\/admin"\)/);
assert.equal((analytics.match(/gtag\/js\?id=/g) ?? []).length, 1);

const backup = readFileSync("lib/backup.ts", "utf8");
assert.doesNotMatch(backup, /GA_MEASUREMENT|google-analytics/);

console.log(JSON.stringify({ googleAnalytics: "pass", id: getGoogleAnalyticsId() }));