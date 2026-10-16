import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatFrameSizePublic } from "../lib/product-fields";
import { getStockLevel } from "../lib/stock-status";

assert.equal(formatFrameSizePublic("051/015"), "51/15");
assert.equal(formatFrameSizePublic("052-018"), "52/18");

assert.equal(getStockLevel(5, 3), "in");
assert.equal(getStockLevel(2, 5), "low");
assert.equal(getStockLevel(0, 5), "out");

const stockPage = readFileSync("app/admin/stock/page.tsx", "utf8");
assert.match(stockPage, /PAGE_SIZE = 10/);
assert.match(stockPage, /minimumStock/);
assert.doesNotMatch(stockPage, /colUpdated/);
assert.doesNotMatch(stockPage, /formatUpdatedAt/);
assert.match(stockPage, /filteredRows/);
assert.match(stockPage, /productNumber\(product\)/);

const css = readFileSync("app/globals.css", "utf8");
assert.match(css, /admin-stock-edit-head/);
assert.match(css, /max-width: 45%/);

console.log(JSON.stringify({ adminStock: "pass" }));
