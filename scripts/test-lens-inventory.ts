import assert from "node:assert/strict";
import {
  LENS_CYL,
  LENS_SPH_ONLY_CYL,
  buildLensOrderDocumentHtml,
  buildLensOrderRows,
  formatLensCylDisplay,
  formatLensOrderDate,
  getLensCell,
  isAllowedCyl,
  isSphOnlyCyl,
  lensCellKey,
  lensOrderTotals,
  normalizeLensInventory,
  quantityToOrder,
  sanitizeLensInventoryCell,
  upsertLensInventoryCell,
} from "../lib/lens-inventory";
import type { LensInventoryCell } from "../lib/types";

function cell(
  overrides: Partial<LensInventoryCell> &
    Pick<LensInventoryCell, "type" | "sph" | "cyl">,
): LensInventoryCell {
  return {
    currentStock: 1,
    desiredStock: 2,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

assert.equal(LENS_SPH_ONLY_CYL, "0.00");
assert.equal(isSphOnlyCyl("0.00"), true);
assert.equal(isSphOnlyCyl("-0.25"), false);
assert.equal(isAllowedCyl("0.00"), true);
for (const cyl of LENS_CYL) {
  assert.equal(isAllowedCyl(cyl), true, cyl);
  assert.notEqual(cyl, LENS_SPH_ONLY_CYL);
}
assert.equal(isAllowedCyl("-2.25"), false);
assert.equal(isAllowedCyl("0"), false);
assert.equal(isAllowedCyl("+0.00"), false);
assert.equal(formatLensCylDisplay("0.00"), "—");
assert.equal(formatLensCylDisplay("-0.75"), "-0.75");

assert.equal(
  lensCellKey("minus", "-1.00", LENS_SPH_ONLY_CYL),
  "minus:-1.00:0.00",
);
assert.notEqual(
  lensCellKey("minus", "-1.00", LENS_SPH_ONLY_CYL),
  lensCellKey("minus", "-1.00", "-0.25"),
);

const existingCyl = cell({
  type: "minus",
  sph: "-1.00",
  cyl: "-0.25",
  currentStock: 4,
  desiredStock: 6,
});
const sphOnly = cell({
  type: "minus",
  sph: "-1.00",
  cyl: LENS_SPH_ONLY_CYL,
  currentStock: 2,
  desiredStock: 5,
});
const plusCyl = cell({
  type: "plus",
  sph: "+2.00",
  cyl: "-2.00",
  currentStock: 3,
  desiredStock: 3,
});

const normalized = normalizeLensInventory([
  existingCyl,
  sphOnly,
  plusCyl,
  { type: "minus", sph: "-1.00", cyl: "oops", currentStock: 9, desiredStock: 9 },
  {
    type: "minus",
    sph: "PLANO",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 0,
    desiredStock: 4,
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
]);
assert.equal(normalized.length, 4);
assert.equal(
  getLensCell(normalized, "minus", "-1.00", "-0.25").currentStock,
  4,
);
assert.equal(
  getLensCell(normalized, "minus", "-1.00", "-0.25").desiredStock,
  6,
);
assert.deepEqual(getLensCell(normalized, "minus", "-2.00", LENS_SPH_ONLY_CYL), {
  currentStock: 0,
  desiredStock: 0,
});
assert.deepEqual(getLensCell([], "plus", "+0.25", "-0.50"), {
  currentStock: 0,
  desiredStock: 0,
});

assert.equal(
  sanitizeLensInventoryCell({
    type: "plus",
    sph: "+1.25",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 0,
    desiredStock: 0,
  })?.cyl,
  "0.00",
);
assert.equal(
  sanitizeLensInventoryCell({
    type: "minus",
    sph: "-0.50",
    cyl: "-0.25",
    currentStock: 1,
    desiredStock: 1,
  })?.cyl,
  "-0.25",
);

const afterSphSave = upsertLensInventoryCell([existingCyl], sphOnly);
assert.equal(afterSphSave.length, 2);
assert.equal(
  getLensCell(afterSphSave, "minus", "-1.00", "-0.25").currentStock,
  4,
);
assert.equal(
  getLensCell(afterSphSave, "minus", "-1.00", LENS_SPH_ONLY_CYL).currentStock,
  2,
);

const clearedSph = upsertLensInventoryCell(afterSphSave, {
  ...sphOnly,
  currentStock: 0,
  desiredStock: 0,
});
assert.equal(clearedSph.length, 1);
assert.equal(clearedSph[0].cyl, "-0.25");
assert.equal(clearedSph[0].currentStock, 4);

assert.equal(quantityToOrder(2, 5), 3);
assert.equal(quantityToOrder(5, 2), 0);

const orderRows = buildLensOrderRows([
  existingCyl,
  sphOnly,
  plusCyl,
  cell({
    type: "plus",
    sph: "+0.25",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 1,
    desiredStock: 4,
  }),
  cell({
    type: "minus",
    sph: "PLANO",
    cyl: "-1.00",
    currentStock: 0,
    desiredStock: 2,
  }),
  cell({
    type: "minus",
    sph: "-4.50",
    cyl: LENS_SPH_ONLY_CYL,
    currentStock: 8,
    desiredStock: 8,
  }),
]);

assert.deepEqual(
  orderRows.map((row) => `${row.type}:${row.sph}:${row.cyl}:${row.quantityToOrder}`),
  [
    "minus:PLANO:-1.00:2",
    "minus:-1.00:0.00:3",
    "minus:-1.00:-0.25:2",
    "plus:+0.25:0.00:3",
  ],
);

const totals = lensOrderTotals(orderRows);
assert.equal(totals.combinations, 4);
assert.equal(totals.quantity, 10);

const generatedAt = new Date("2026-10-08T12:00:00.000Z");
const html = buildLensOrderDocumentHtml(orderRows, generatedAt);

assert.match(html, /lang="he"/);
assert.match(html, /dir="rtl"/);
assert.match(html, /Noto Sans Hebrew/);
assert.match(html, /OYON OPTICS/);
assert.match(html, /רשימת הזמנה לעדשות/);
assert.match(html, /סה״כ שורות: 4/);
assert.match(html, /סה״כ להזמנה: 10/);
assert.match(html, /סה״כ כמות להזמנה: 10/);
assert.match(html, /סוג עדשה/);
assert.match(html, /כמות להזמנה/);
assert.match(html, /thead \{ display: table-header-group; \}/);
assert.match(html, /page-break-inside: avoid/);
assert.match(html, /A4 portrait/);

assert.doesNotMatch(html, /طلبية/);
assert.doesNotMatch(html, /المخزون الحالي/);
assert.doesNotMatch(html, /المخزون المطلوب/);
assert.doesNotMatch(html, /كمية الطلب/);
assert.doesNotMatch(html, /نوع العدسة/);
assert.doesNotMatch(html, /lang="ar"/);
assert.doesNotMatch(html, />4<\/td>\s*<td class="num">6</);
assert.doesNotMatch(html, /currentStock/);
assert.doesNotMatch(html, /desiredStock/);

assert.match(html, /<td class="ltr">PLANO<\/td>/);
assert.match(html, /<td class="ltr">-1\.00<\/td>/);
assert.match(html, /<td class="ltr">\+0\.25<\/td>/);
assert.match(html, /<td class="ltr">—<\/td>/);
assert.match(html, /<td>\(-\)<\/td>/);
assert.match(html, /<td>\(\+\)<\/td>/);
assert.match(html, /<td class="qty">3<\/td>/);

const htmlCylCells = [...html.matchAll(/<td class="ltr">([^<]*)<\/td>/g)].map(
  (match) => match[1],
);
assert.ok(htmlCylCells.includes("—"));
assert.ok(htmlCylCells.includes("-0.25"));
assert.ok(htmlCylCells.includes("-1.00"));
assert.equal(html.includes("0.00"), false);

const hebrewDate = formatLensOrderDate(generatedAt);
assert.match(hebrewDate, /[\u0590-\u05FF]/);

const emptyHtml = buildLensOrderDocumentHtml([]);
assert.match(emptyHtml, /סה״כ שורות: 0/);
assert.match(emptyHtml, /סה״כ כמות להזמנה: 0/);
assert.match(emptyHtml, /אין פריטים להזמנה/);

console.log("lens-inventory tests passed");
