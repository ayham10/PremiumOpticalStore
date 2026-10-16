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
  buildLensOrderRows,
  compareLensOrderRows,
  formatLensOrderCyl,
  LENS_ORDER_PDF_FILENAME,
  lensOrderPdfFilename,
  lensOrderSection,
  lensOrderSectionMark,
  lensOrderTotals,
  sortLensOrderRows,
} from "../lib/lens-inventory";
import { buildLensOrderPdf } from "../lib/lens-order-pdf";
import { buildLensOrderDocumentHtml } from "../lib/lens-order-sheet";
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
assert.equal(formatLensOrderCyl("0.00"), "-");
assert.equal(formatLensOrderCyl("-0.75"), "-0.75");
assert.equal(lensOrderPdfFilename(new Date("2026-10-15T12:00:00.000Z")), "רשימת הזמנות.pdf");
assert.equal(LENS_ORDER_PDF_FILENAME, "רשימת הזמנות.pdf");
assert.equal(lensOrderSectionMark("negative"), "−");
assert.equal(lensOrderSectionMark("positive"), "+");

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
    "PLANO/-:7",
    "-1.00/-:3",
    "-4.50/-:2",
    "PLANO/-0.25:3",
    "-0.25/-0.25:2",
    "+0.25/-:3",
    "+1.00/-:1",
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
    /<td class="num">(\d+)<\/td>\s*<td class="ltr">([^<]*)<\/td>\s*<td class="ltr">([^<]*)<\/td>\s*<td class="qty">(\d+)<\/td>/g,
  ),
].map((match) => `${match[2]}/${match[3]}`);
assert.deepEqual(
  htmlKeys,
  orderRows.map((row) => `${row.sph}/${formatLensOrderCyl(row.cyl)}`),
);
assert.doesNotMatch(html, /מלאי נוכחי/);
assert.doesNotMatch(html, /<th[^>]*>כמות נדרשת/);
assert.match(html, /OYON OPTICS/);
assert.match(html, /עיון אופטיקה/);
assert.match(html, /שם העסק:/);
assert.match(html, />SPH<\/span> \(ספירה\)/);
assert.match(html, />CYL<\/span> \(צילינדר\)/);
assert.match(html, /oyon-order-logo\.png/);
assert.doesNotMatch(html, /עיניים אופטיקה/);

assert.equal(pdfRtlText("עיון אופטיקה"), [... "עיון אופטיקה"].reverse().join(""));
assert.match(pdfRtlText("قائمة الطلبية"), /[\uFE70-\uFEFF]|[\u0600-\u06FF]/);
assert.match(pdfRtlText("סה״כ כמות להזמנה: 24"), /24/);
assert.doesNotMatch(pdfRtlText("סה״כ כמות להזמנה: 24"), /42/);
assert.match(pdfRtlText("15 באוקטובר 2026"), /15/);
assert.match(pdfRtlText("15 באוקטובר 2026"), /2026/);

const fonts = {
  latin: new Uint8Array(readFileSync(join("public/fonts/NotoSans-Regular.ttf"))),
  hebrew: new Uint8Array(readFileSync(join("public/fonts/NotoSansHebrew-Regular.ttf"))),
  arabic: new Uint8Array(readFileSync(join("public/fonts/NotoNaskhArabic-Regular.ttf"))),
};
const logo = new Uint8Array(readFileSync(join("public/images/oyon-order-logo.png")));

const generatedAt = new Date("2026-10-15T09:00:00.000Z");
const pdf = buildLensOrderPdf(orderRows, { generatedAt, fonts, logo });
const header = Buffer.from(pdf.bytes.subarray(0, 8)).toString("latin1");
assert.equal(header.startsWith("%PDF-"), true, header);
assert.equal(pdf.filename, "רשימת הזמנות.pdf");
assert.equal(pdf.pageCount >= 1, true);
assert.notEqual(Buffer.from(pdf.bytes.subarray(0, 15)).toString("utf8").includes("<!DOCTYPE"), true);

const latin1 = Buffer.from(pdf.bytes).toString("latin1");
assert.match(latin1, /%PDF-/);
assert.match(latin1, /%%EOF/);
assert.match(latin1, /\/Subtype\s*\/Image/);
assert.doesNotMatch(latin1, /<!DOCTYPE html>/);
assert.doesNotMatch(latin1, /instagram/i);

const page = readFileSync("app/admin/lens-inventory/page.tsx", "utf8");
assert.match(page, /printLensOrderPdf/);
assert.match(page, /downloadLensOrderPdf/);
assert.doesNotMatch(page, /buildLensOrderDocumentHtml/);
assert.doesNotMatch(page, /openOrderDocument/);
const downloadSrc = readFileSync("lib/lens-order-pdf-download.ts", "utf8");
assert.match(downloadSrc, /createLensOrderPdf/);
assert.match(downloadSrc, /printLensOrderPdf/);
assert.match(downloadSrc, /downloadLensOrderPdf/);
assert.match(downloadSrc, /application\/pdf/);
assert.match(downloadSrc, /oyon-order-logo\.png/);

const pdfWithPhone = buildLensOrderPdf(orderRows, {
  generatedAt,
  fonts,
  logo,
  phone: "052-123-4567",
});
assert.equal(pdfWithPhone.filename, "רשימת הזמנות.pdf");
assert.equal(pdfWithPhone.pageCount, pdf.pageCount);
assert.notEqual(Buffer.from(pdfWithPhone.bytes).equals(Buffer.from(pdf.bytes)), true);

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

const multi = buildLensOrderPdf(manyRows, { generatedAt, fonts, logo });
assert.equal(Buffer.from(multi.bytes.subarray(0, 5)).toString("latin1"), "%PDF-");
assert.ok(multi.pageCount >= 2, `expected multi-page PDF, got ${multi.pageCount}`);
assert.ok(multi.bytes.byteLength > 5000);

const printNoPhone = buildLensOrderDocumentHtml(manyRows, { generatedAt });
const printWithPhone = buildLensOrderDocumentHtml(manyRows, {
  generatedAt,
  phone: "052-123-4567",
});
const tbodyOf = (source: string) => source.match(/<tbody>[\s\S]*<\/tbody>/)?.[0];
assert.equal(tbodyOf(printNoPhone), tbodyOf(printWithPhone));
assert.doesNotMatch(printNoPhone, /052-123-4567/);
assert.match(printWithPhone, /052-123-4567/);
assert.doesNotMatch(printNoPhone, /instagram/i);
assert.doesNotMatch(printWithPhone, /instagram/i);

const multiWithPhone = buildLensOrderPdf(manyRows, {
  generatedAt,
  fonts,
  logo,
  phone: "052-123-4567",
});
assert.equal(multiWithPhone.filename, "רשימת הזמנות.pdf");
assert.equal(multiWithPhone.pageCount, multi.pageCount);
assert.notEqual(
  Buffer.from(multiWithPhone.bytes).equals(Buffer.from(multi.bytes)),
  true,
);

const artifact = join("/tmp", "רשימת הזמנות.pdf");
writeFileSync(artifact, multi.bytes);
assert.equal(readFileSync(artifact).subarray(0, 5).toString("latin1"), "%PDF-");
writeFileSync("/tmp/oyon-lens-order-with-phone.pdf", multiWithPhone.bytes);
writeFileSync("/tmp/oyon-lens-order-without-phone.pdf", multi.bytes);

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
