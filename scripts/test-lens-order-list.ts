import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LENS_CYL,
  LENS_MINUS_SPH,
  LENS_ORDER_CYL_SEQUENCE,
  LENS_PLUS_SPH,
  LENS_SPH_ONLY_CYL,
  buildLensOrderDisplayItems,
  buildLensOrderDocumentHtml,
  buildLensOrderRows,
  compareLensOrderRows,
  formatLensOrderCyl,
  lensOrderPdfFilename,
  lensOrderSection,
  lensOrderTotals,
  sortLensOrderRows,
} from "../lib/lens-inventory";
import { buildLensOrderPdf } from "../lib/lens-order-pdf";
import { pdfRtlText } from "../lib/rtl-pdf-text";
import type { LensInventoryCell } from "../lib/types";
import type { LensOrderRow } from "../lib/lens-inventory";

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

assert.deepEqual([...LENS_ORDER_CYL_SEQUENCE], [
  "0.00",
  ...LENS_CYL,
]);
assert.equal(formatLensOrderCyl("0.00"), "0.00");
assert.equal(formatLensOrderCyl("-0.75"), "-0.75");
assert.equal(lensOrderPdfFilename(new Date("2026-10-15T12:00:00.000Z")), "OYON-Lens-Order-2026-10-15.pdf");

const mixed: LensInventoryCell[] = [
  cell({ type: "plus", sph: "+4.75", cyl: "-2.00", currentStock: 1, desiredStock: 4 }),
  cell({ type: "minus", sph: "-4.50", cyl: LENS_SPH_ONLY_CYL, currentStock: 0, desiredStock: 2 }),
  cell({ type: "plus", sph: "+0.25", cyl: LENS_SPH_ONLY_CYL, currentStock: 2, desiredStock: 5 }),
  cell({ type: "minus", sph: "PLANO", cyl: "-0.25", currentStock: 3, desiredStock: 6 }),
  cell({ type: "minus", sph: "-0.25", cyl: "-0.25", currentStock: 1, desiredStock: 3 }),
  cell({ type: "minus", sph: "PLANO", cyl: LENS_SPH_ONLY_CYL, currentStock: 0, desiredStock: 7 }),
  cell({ type: "plus", sph: "+0.25", cyl: "-0.25", currentStock: 4, desiredStock: 4 }),
  cell({ type: "minus", sph: "-1.00", cyl: LENS_SPH_ONLY_CYL, currentStock: 5, desiredStock: 8 }),
  cell({ type: "plus", sph: "+1.00", cyl: LENS_SPH_ONLY_CYL, currentStock: 0, desiredStock: 1 }),
];

const shuffled = [
  mixed[6]!,
  mixed[2]!,
  mixed[0]!,
  mixed[8]!,
  mixed[4]!,
  mixed[1]!,
  mixed[7]!,
  mixed[3]!,
  mixed[5]!,
];

const orderRows = buildLensOrderRows(shuffled);
assert.deepEqual(
  orderRows.map((row) => `${row.sph}/${formatLensOrderCyl(row.cyl)}:${row.quantityToOrder}`),
  [
    "PLANO/0.00:7",
    "-1.00/0.00:3",
    "-4.50/0.00:2",
    "PLANO/-0.25:3",
    "-0.25/-0.25:2",
    "+0.25/0.00:3",
    "+1.00/0.00:1",
    "+4.75/-2.00:3",
  ],
);

assert.equal(
  orderRows.find((row) => row.sph === "PLANO" && row.cyl === LENS_SPH_ONLY_CYL)?.quantityToOrder,
  7,
);
assert.equal(
  orderRows.find((row) => row.sph === "-1.00" && row.cyl === LENS_SPH_ONLY_CYL)?.quantityToOrder,
  3,
);
assert.equal(
  orderRows.some((row) => row.sph === "+0.25" && row.cyl === "-0.25"),
  false,
);

assert.deepEqual(
  orderRows.filter((row) => lensOrderSection(row) === "negative").map((row) => row.sph),
  ["PLANO", "-1.00", "-4.50", "PLANO", "-0.25"],
);
assert.ok(
  orderRows.every((row, index, list) => {
    if (index === 0) return true;
    return compareLensOrderRows(list[index - 1]!, row) <= 0;
  }),
);

const firstPositive = orderRows.findIndex((row) => lensOrderSection(row) === "positive");
assert.ok(firstPositive > 0);
assert.ok(
  orderRows.slice(0, firstPositive).every((row) => lensOrderSection(row) === "negative"),
);
assert.ok(
  orderRows.slice(firstPositive).every((row) => lensOrderSection(row) === "positive"),
);

const display = buildLensOrderDisplayItems(orderRows);
assert.equal(display[0]?.kind, "section");
if (display[0]?.kind === "section") assert.equal(display[0].id, "negative");
assert.ok(display.some((item) => item.kind === "section" && item.id === "positive"));
assert.equal(display.filter((item) => item.kind === "row").length, orderRows.length);

const resorted: LensOrderRow[] = sortLensOrderRows([...orderRows].reverse());
assert.deepEqual(
  resorted.map((row) => `${row.sph}:${row.cyl}`),
  orderRows.map((row) => `${row.sph}:${row.cyl}`),
);

const html = buildLensOrderDocumentHtml(orderRows);
const htmlKeys = [
  ...html.matchAll(
    /<td class="num">(\d+)<\/td>\s*<td class="ltr">([^<]*)<\/td>\s*<td class="ltr">([^<]*)<\/td>/g,
  ),
].map((match) => `${match[2]}/${match[3]}`);
assert.deepEqual(
  htmlKeys,
  orderRows.map((row) => `${row.sph}/${formatLensOrderCyl(row.cyl)}`),
);

assert.equal(pdfRtlText("עיון אופטיקה"), [... "עיון אופטיקה"].reverse().join(""));
assert.match(pdfRtlText("قائمة الطلبية"), /[\uFE70-\uFEFF]|[\u0600-\u06FF]/);

const fonts = {
  latin: new Uint8Array(readFileSync(join("public/fonts/NotoSans-Regular.ttf"))),
  hebrew: new Uint8Array(readFileSync(join("public/fonts/NotoSansHebrew-Regular.ttf"))),
  arabic: new Uint8Array(readFileSync(join("public/fonts/NotoNaskhArabic-Regular.ttf"))),
};

const generatedAt = new Date("2026-10-15T09:00:00.000Z");
const pdf = buildLensOrderPdf(orderRows, { generatedAt, fonts });
const header = Buffer.from(pdf.bytes.subarray(0, 8)).toString("latin1");
assert.equal(header.startsWith("%PDF-"), true, header);
assert.equal(pdf.filename, "OYON-Lens-Order-2026-10-15.pdf");
assert.equal(pdf.pageCount >= 1, true);
assert.notEqual(Buffer.from(pdf.bytes.subarray(0, 15)).toString("utf8").includes("<!DOCTYPE"), true);

const latin1 = Buffer.from(pdf.bytes).toString("latin1");
assert.match(latin1, /%PDF-/);
assert.match(latin1, /%%EOF/);
assert.doesNotMatch(latin1, /<!DOCTYPE html>/);

const pdfTotals = lensOrderTotals(orderRows);
assert.equal(pdfTotals.quantity, 24);
assert.equal(pdfTotals.requiredQuantity, 36);

const many: LensInventoryCell[] = [];
for (const sph of LENS_MINUS_SPH) {
  for (const cyl of LENS_ORDER_CYL_SEQUENCE) {
    many.push(
      cell({
        type: "minus",
        sph,
        cyl,
        currentStock: 0,
        desiredStock: 2,
      }),
    );
  }
}
for (const sph of LENS_PLUS_SPH) {
  for (const cyl of LENS_ORDER_CYL_SEQUENCE) {
    many.push(
      cell({
        type: "plus",
        sph,
        cyl,
        currentStock: 1,
        desiredStock: 3,
      }),
    );
  }
}

const manyRows = buildLensOrderRows(many);
assert.equal(manyRows.length, LENS_MINUS_SPH.length * LENS_ORDER_CYL_SEQUENCE.length + LENS_PLUS_SPH.length * LENS_ORDER_CYL_SEQUENCE.length);
assert.equal(manyRows[0]?.sph, "PLANO");
assert.equal(manyRows[0]?.cyl, LENS_SPH_ONLY_CYL);
assert.equal(manyRows[LENS_MINUS_SPH.length]?.sph, "PLANO");
assert.equal(manyRows[LENS_MINUS_SPH.length]?.cyl, "-0.25");
const firstPlus = manyRows.findIndex((row) => row.type === "plus");
assert.equal(manyRows[firstPlus - 1]?.type, "minus");
assert.equal(manyRows[firstPlus]?.sph, "+0.25");
assert.equal(manyRows[firstPlus]?.cyl, LENS_SPH_ONLY_CYL);
assert.equal(manyRows[manyRows.length - 1]?.sph, "+4.75");
assert.equal(manyRows[manyRows.length - 1]?.cyl, "-2.00");
assert.equal(
  manyRows.filter((row) => row.sph === "PLANO" && row.cyl === LENS_SPH_ONLY_CYL)[0]?.quantityToOrder,
  2,
);
assert.equal(
  manyRows.filter((row) => row.sph === "+4.75" && row.cyl === "-2.00")[0]?.quantityToOrder,
  2,
);

const multi = buildLensOrderPdf(manyRows, { generatedAt, fonts });
assert.equal(Buffer.from(multi.bytes.subarray(0, 5)).toString("latin1"), "%PDF-");
assert.ok(multi.pageCount >= 2, `expected multi-page PDF, got ${multi.pageCount}`);
assert.ok(multi.bytes.byteLength > 5000);

const artifact = join("/tmp", "OYON-Lens-Order-2026-10-15.pdf");
writeFileSync(artifact, multi.bytes);
assert.equal(readFileSync(artifact).subarray(0, 5).toString("latin1"), "%PDF-");

console.log(
  JSON.stringify({
    isolated: "pass",
    sort: true,
    planoBeforeNegative: true,
    positiveAfterNegative: true,
    quantities: true,
    printMatchesSort: true,
    pdfSignature: true,
    pdfPages: multi.pageCount,
    pdfBytes: multi.bytes.byteLength,
    orderRows: manyRows.length,
  }),
);
